#!/usr/bin/env node

import crypto from 'node:crypto';
import net from 'node:net';
import tls from 'node:tls';

const VV_BUILDING_ID = '88e6c11e-4a8c-4f39-a571-5f97e7f2b774';
const DEFAULT_CONNECT_TIMEOUT_MS = 15000;

const EXPECTED_COUNTS = {
  pqrs_cases: 1,
  inspection_plans: 1,
  inspection_rounds: 1,
  inspection_findings: 1,
  work_assignments: 1,
  incident_tickets: 1,
  inventory_locations: 1,
  inventory_items: 1,
  inventory_movements: 1,
  service_listings: 1,
  documents: 1,
  weekly_reports: 1,
  spend_policies: 1,
};

const SEED_CHECK_LABELS = {
  pqrs_case: 'PQRS VV-PQRS-E2E-000001',
  inspection_plan: 'recorrido plan E2E-RECORRIDO',
  inspection_round: 'recorrido round REC-E2E-001',
  inspection_finding: 'seed finding',
  work_assignment: 'work assignment WO-E2E-001',
  incident_ticket: 'incident INC-E2E-001',
  inventory: 'inventory E2E-CLORO at E2E-ALM with balance 3 / reorder 5',
  provider: 'provider Proveedor E2E Jardineria',
  document: 'document E2E Reglamento de prueba',
  weekly_report: 'weekly report Semana E2E',
  spend_policy: 'spend policy seed-spend-policy-e2e',
};

function usage() {
  console.log(`Usage: node scripts/vv-e2e-seed-verify.mjs [--allow-extra-operational] [--connect-timeout-ms MS]

Read-only verifier for the clean Villa Valencia post-reset E2E seed.

Environment:
  POSTGRES_URL or DATABASE_URL must point to the Villa Valencia production DB.

Checks:
  - Opens a PostgreSQL BEGIN READ ONLY transaction and runs SELECTs only.
  - Verifies preserved foundation rows: Villa building, active admin user, user.
  - Verifies each clean E2E seed example by its known reference/label.
  - Verifies lookup_pqrs_case('VV-PQRS-E2E-000001') returns exactly that row.
  - Verifies get_md04_lite_exceptions(Villa building) returns OPEN_FINDING and STOCK_OUT seed examples.
  - By default, fails if tracked operational tables have extra rows beyond the clean seed.

Options:
  --allow-extra-operational   Permit row counts above the clean seed expectations.
  --connect-timeout-ms MS     PostgreSQL connection timeout. Default: ${DEFAULT_CONNECT_TIMEOUT_MS}.
  --help                      Show this help.

This script does not insert, update, delete, import, truncate, create, drop, or deploy.`);
}

function parseArgs(argv) {
  const options = {
    allowExtraOperational: false,
    connectTimeoutMs: DEFAULT_CONNECT_TIMEOUT_MS,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    if (arg === '--allow-extra-operational') {
      options.allowExtraOperational = true;
      continue;
    }
    if (arg === '--connect-timeout-ms') {
      options.connectTimeoutMs = Number(argv[++i] || 0);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!Number.isFinite(options.connectTimeoutMs) || options.connectTimeoutMs <= 0) {
    throw new Error('--connect-timeout-ms must be a positive number');
  }

  return options;
}

function cstring(value) {
  return Buffer.from(`${value}\0`);
}

function writeInt32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeInt32BE(value, 0);
  return buffer;
}

function pgMessage(type, body) {
  const bodyBuffer = Buffer.isBuffer(body) ? body : Buffer.from(body || '');
  return Buffer.concat([Buffer.from(type), writeInt32(bodyBuffer.length + 4), bodyBuffer]);
}

function parseError(payload) {
  const fields = {};
  let offset = 0;
  while (offset < payload.length && payload[offset] !== 0) {
    const code = String.fromCharCode(payload[offset]);
    offset += 1;
    const end = payload.indexOf(0, offset);
    if (end === -1) break;
    fields[code] = payload.toString('utf8', offset, end);
    offset = end + 1;
  }
  return fields.M || fields.D || JSON.stringify(fields);
}

function parseCstringList(payload, offset) {
  const values = [];
  while (offset < payload.length && payload[offset] !== 0) {
    const end = payload.indexOf(0, offset);
    if (end === -1) break;
    values.push(payload.toString('utf8', offset, end));
    offset = end + 1;
  }
  return values;
}

function saslPrep(value) {
  return String(value).replace(/=/g, '=3D').replace(/,/g, '=2C');
}

function xorBuffers(left, right) {
  const out = Buffer.alloc(left.length);
  for (let i = 0; i < left.length; i += 1) out[i] = left[i] ^ right[i];
  return out;
}

function parseScramAttributes(value) {
  const attrs = {};
  for (const part of value.split(',')) {
    attrs[part.slice(0, 1)] = part.slice(2);
  }
  return attrs;
}

function makeScramState(user) {
  const nonce = crypto.randomBytes(18).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 24);
  const clientFirstBare = `n=${saslPrep(user)},r=${nonce}`;
  return {
    nonce,
    clientFirstBare,
    clientFirstMessage: `n,,${clientFirstBare}`,
  };
}

function buildScramFinal({ password, state, serverFirstMessage }) {
  const attrs = parseScramAttributes(serverFirstMessage);
  if (!attrs.r || !attrs.r.startsWith(state.nonce)) throw new Error('PostgreSQL SCRAM nonce validation failed');
  if (!attrs.s || !attrs.i) throw new Error('PostgreSQL SCRAM challenge was missing salt or iterations');

  const clientFinalWithoutProof = `c=biws,r=${attrs.r}`;
  const authMessage = `${state.clientFirstBare},${serverFirstMessage},${clientFinalWithoutProof}`;
  const saltedPassword = crypto.pbkdf2Sync(
    password,
    Buffer.from(attrs.s, 'base64'),
    Number(attrs.i),
    32,
    'sha256',
  );
  const clientKey = crypto.createHmac('sha256', saltedPassword).update('Client Key').digest();
  const storedKey = crypto.createHash('sha256').update(clientKey).digest();
  const clientSignature = crypto.createHmac('sha256', storedKey).update(authMessage).digest();
  const clientProof = xorBuffers(clientKey, clientSignature).toString('base64');
  const serverKey = crypto.createHmac('sha256', saltedPassword).update('Server Key').digest();
  const serverSignature = crypto.createHmac('sha256', serverKey).update(authMessage).digest('base64');

  return {
    message: `${clientFinalWithoutProof},p=${clientProof}`,
    serverSignature,
  };
}

class PgWireClient {
  constructor(url, { connectTimeoutMs }) {
    this.url = new URL(url);
    this.connectTimeoutMs = connectTimeoutMs;
    this.buffer = Buffer.alloc(0);
    this.waiters = [];
  }

  get sslMode() {
    // Vercel/Supabase pooled URLs in this project may present a certificate
    // chain that Node cannot validate on minimal hosts. Match the repo's
    // existing production DB smoke behavior by defaulting to encrypted but
    // non-verifying TLS; callers can opt into strict validation with
    // ?sslmode=require when their trust store is complete.
    return this.url.searchParams.get('sslmode') || 'no-verify';
  }

  get user() {
    return decodeURIComponent(this.url.username || '');
  }

  get password() {
    return decodeURIComponent(this.url.password || '');
  }

  get database() {
    return decodeURIComponent((this.url.pathname || '').replace(/^\//, ''));
  }

  async connect() {
    const host = this.url.hostname;
    const port = Number(this.url.port || 5432);
    let socket = net.connect({ host, port });
    await this.awaitConnect(socket);

    if (this.sslMode !== 'disable') {
      socket.write(Buffer.concat([writeInt32(8), writeInt32(80877103)]));
      const response = await this.readRawByte(socket);
      if (response !== 83) throw new Error('PostgreSQL server did not accept SSL');
      socket = tls.connect({
        socket,
        servername: host,
        rejectUnauthorized: this.sslMode !== 'no-verify',
      });
      await this.awaitConnect(socket);
    }

    this.socket = socket;
    this.socket.on('data', (chunk) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.flushWaiters();
    });
    this.socket.on('error', (error) => {
      while (this.waiters.length) this.waiters.shift().reject(error);
    });

    await this.startup();
  }

  awaitConnect(socket) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.destroy();
        reject(new Error(`PostgreSQL connection timed out after ${this.connectTimeoutMs}ms`));
      }, this.connectTimeoutMs);
      socket.once('connect', () => {
        clearTimeout(timeout);
        resolve();
      });
      socket.once('secureConnect', () => {
        clearTimeout(timeout);
        resolve();
      });
      socket.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  readRawByte(socket) {
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        socket.off('data', onData);
        socket.off('error', onError);
      };
      const onData = (chunk) => {
        cleanup();
        if (chunk.length > 1) this.buffer = Buffer.concat([chunk.subarray(1), this.buffer]);
        resolve(chunk[0]);
      };
      const onError = (error) => {
        cleanup();
        reject(error);
      };
      socket.once('data', onData);
      socket.once('error', onError);
    });
  }

  flushWaiters() {
    while (this.waiters.length) {
      const waiter = this.waiters[0];
      if (this.buffer.length < waiter.bytes) return;
      this.waiters.shift();
      const out = this.buffer.subarray(0, waiter.bytes);
      this.buffer = this.buffer.subarray(waiter.bytes);
      waiter.resolve(out);
    }
  }

  readBytes(bytes) {
    if (this.buffer.length >= bytes) {
      const out = this.buffer.subarray(0, bytes);
      this.buffer = this.buffer.subarray(bytes);
      return Promise.resolve(out);
    }
    return new Promise((resolve, reject) => {
      this.waiters.push({ bytes, resolve, reject });
    });
  }

  async readMessage() {
    const type = (await this.readBytes(1)).toString('utf8');
    const lengthBuffer = await this.readBytes(4);
    const length = lengthBuffer.readInt32BE(0);
    const payload = await this.readBytes(length - 4);
    return { type, payload };
  }

  send(type, body) {
    this.socket.write(pgMessage(type, body));
  }

  async startup() {
    const params = [
      cstring('user'), cstring(this.user),
      cstring('database'), cstring(this.database),
      cstring('application_name'), cstring('vv-e2e-seed-verify'),
      cstring('client_encoding'), cstring('UTF8'),
      Buffer.from([0]),
    ];
    const body = Buffer.concat([writeInt32(196608), ...params]);
    this.socket.write(Buffer.concat([writeInt32(body.length + 4), body]));

    let scramState = null;
    let serverSignature = null;

    while (true) {
      const { type, payload } = await this.readMessage();
      if (type === 'R') {
        const authCode = payload.readInt32BE(0);
        if (authCode === 0) continue;
        if (authCode === 3) {
          this.send('p', cstring(this.password));
          continue;
        }
        if (authCode === 5) {
          const salt = payload.subarray(4, 8);
          const inner = crypto.createHash('md5').update(this.password + this.user).digest('hex');
          const outer = crypto.createHash('md5').update(Buffer.concat([Buffer.from(inner), salt])).digest('hex');
          this.send('p', cstring(`md5${outer}`));
          continue;
        }
        if (authCode === 10) {
          const mechanisms = parseCstringList(payload, 4);
          if (!mechanisms.includes('SCRAM-SHA-256')) {
            throw new Error(`PostgreSQL requested unsupported SASL mechanism(s): ${mechanisms.join(', ')}`);
          }
          scramState = makeScramState(this.user);
          const initial = Buffer.from(scramState.clientFirstMessage);
          this.send('p', Buffer.concat([
            cstring('SCRAM-SHA-256'),
            writeInt32(initial.length),
            initial,
          ]));
          continue;
        }
        if (authCode === 11) {
          const serverFirstMessage = payload.toString('utf8', 4);
          const final = buildScramFinal({
            password: this.password,
            state: scramState,
            serverFirstMessage,
          });
          serverSignature = final.serverSignature;
          this.send('p', Buffer.from(final.message));
          continue;
        }
        if (authCode === 12) {
          const attrs = parseScramAttributes(payload.toString('utf8', 4));
          if (attrs.v && serverSignature && attrs.v !== serverSignature) {
            throw new Error('PostgreSQL SCRAM server signature validation failed');
          }
          continue;
        }
        throw new Error(`PostgreSQL requested unsupported authentication code ${authCode}`);
      }
      if (type === 'E') throw new Error(`PostgreSQL startup failed: ${parseError(payload)}`);
      if (type === 'Z') return;
    }
  }

  async query(sql) {
    this.send('Q', cstring(sql));
    let fields = [];
    const rows = [];

    while (true) {
      const { type, payload } = await this.readMessage();
      if (type === 'T') {
        fields = [];
        const count = payload.readInt16BE(0);
        let offset = 2;
        for (let i = 0; i < count; i += 1) {
          const end = payload.indexOf(0, offset);
          const name = payload.toString('utf8', offset, end);
          offset = end + 1 + 18;
          fields.push(name);
        }
        continue;
      }
      if (type === 'D') {
        const count = payload.readInt16BE(0);
        let offset = 2;
        const row = {};
        for (let i = 0; i < count; i += 1) {
          const length = payload.readInt32BE(offset);
          offset += 4;
          if (length === -1) {
            row[fields[i]] = null;
          } else {
            row[fields[i]] = payload.toString('utf8', offset, offset + length);
            offset += length;
          }
        }
        rows.push(row);
        continue;
      }
      if (type === 'E') throw new Error(`PostgreSQL query failed: ${parseError(payload)}`);
      if (type === 'Z') return rows;
    }
  }

  close() {
    if (this.socket) this.socket.end(pgMessage('X', Buffer.alloc(0)));
  }
}

function buildVerificationSql() {
  const countUnions = Object.keys(EXPECTED_COUNTS)
    .map((table) => `  SELECT '${table}'::text AS table_name, count(*)::int AS row_count FROM public.${table}`)
    .join('\n  UNION ALL\n');

  return `
WITH tracked_counts AS (
${countUnions}
),
latest_inventory AS (
  SELECT DISTINCT ON (m.inventory_item_id)
    m.inventory_item_id,
    m.inventory_location_id,
    m.balance_after
  FROM public.inventory_movements m
  ORDER BY m.inventory_item_id, m.movement_at DESC
),
pqrs_lookup AS (
  SELECT
    count(*)::int AS row_count,
    coalesce(jsonb_agg(coalesce(to_jsonb(l)->>'case_reference', to_jsonb(l)->>'case_ref')), '[]'::jsonb) AS refs
  FROM public.lookup_pqrs_case('VV-PQRS-E2E-000001') l
),
md04 AS (
  SELECT
    count(*) FILTER (
      WHERE exception_type = 'OPEN_FINDING'
        AND source_table = 'inspection_findings'
        AND (
          source_id = 'seed-finding-e2e'
          OR title ILIKE '%Hallazgo E2E%'
          OR to_jsonb(m)::text ILIKE '%seed-finding-e2e%'
          OR to_jsonb(m)::text ILIKE '%Hallazgo E2E%'
        )
    )::int AS open_finding_count,
    count(*) FILTER (
      WHERE exception_type = 'STOCK_OUT'
        AND source_table = 'inventory_items'
        AND (
          title ILIKE '%E2E-CLORO%'
          OR to_jsonb(m)->'metadata'->>'sku' = 'E2E-CLORO'
          OR to_jsonb(m)::text ILIKE '%E2E-CLORO%'
        )
    )::int AS stock_out_count
  FROM public.get_md04_lite_exceptions('${VV_BUILDING_ID}'::uuid) m
),
seed_checks AS (
  SELECT jsonb_build_object(
    'pqrs_case', EXISTS (
      SELECT 1 FROM public.pqrs_cases WHERE case_reference = 'VV-PQRS-E2E-000001'
    ),
    'inspection_plan', EXISTS (
      SELECT 1 FROM public.inspection_plans
      WHERE plan_code = 'E2E-RECORRIDO' OR name = 'E2E-RECORRIDO'
    ),
    'inspection_round', EXISTS (
      SELECT 1 FROM public.inspection_rounds
      WHERE round_number = 'REC-E2E-001' OR title = 'E2E-RECORRIDO'
    ),
    'inspection_finding', EXISTS (
      SELECT 1 FROM public.inspection_findings
      WHERE id = 'seed-finding-e2e'
        OR description ILIKE '%Hallazgo E2E%'
    ),
    'work_assignment', EXISTS (
      SELECT 1 FROM public.work_assignments
      WHERE assignment_number = 'WO-E2E-001'
    ),
    'incident_ticket', EXISTS (
      SELECT 1 FROM public.incident_tickets
      WHERE ticket_number = 'INC-E2E-001'
    ),
    'inventory', EXISTS (
      SELECT 1
      FROM public.inventory_items i
      JOIN latest_inventory li ON li.inventory_item_id = i.id
      JOIN public.inventory_locations loc ON loc.id = li.inventory_location_id
      WHERE (i.sku = 'E2E-CLORO' OR i.name = 'E2E-CLORO')
        AND (loc.code = 'E2E-ALM' OR loc.name = 'E2E-ALM')
        AND li.balance_after = 3
        AND i.default_reorder_point = 5
    ),
    'provider', EXISTS (
      SELECT 1 FROM public.service_listings s
      WHERE to_jsonb(s)::text ILIKE '%Proveedor E2E Jardiner%'
    ),
    'document', EXISTS (
      SELECT 1 FROM public.documents d
      WHERE to_jsonb(d)::text ILIKE '%E2E Reglamento de prueba%'
    ),
    'weekly_report', EXISTS (
      SELECT 1 FROM public.weekly_reports w
      WHERE to_jsonb(w)::text ILIKE '%Semana E2E%'
    ),
    'spend_policy', EXISTS (
      SELECT 1 FROM public.spend_policies p
      WHERE to_jsonb(p)::text ILIKE '%seed-spend-policy-e2e%'
    )
  ) AS data
)
SELECT jsonb_build_object(
  'foundation', jsonb_build_object(
    'villa_building_count', (
      SELECT count(*)::int FROM public.buildings
      WHERE id = '${VV_BUILDING_ID}'
        OR lower(coalesce(name, '')) LIKE '%villa valencia%'
    ),
    'active_admin_user_count', (
      SELECT count(*)::int FROM public.admin_users
      WHERE coalesce(is_active, true)
    ),
    'user_count', (
      SELECT count(*)::int FROM public.users
    )
  ),
  'counts', (
    SELECT jsonb_object_agg(table_name, row_count ORDER BY table_name)
    FROM tracked_counts
  ),
  'seeds', (SELECT data FROM seed_checks),
  'pqrs_lookup', (
    SELECT jsonb_build_object('row_count', row_count, 'refs', refs)
    FROM pqrs_lookup
  ),
  'md04', (
    SELECT jsonb_build_object(
      'open_finding_count', open_finding_count,
      'stock_out_count', stock_out_count
    )
    FROM md04
  )
)::text AS result;`;
}

function assertResult(result, { allowExtraOperational }) {
  const failures = [];
  const foundation = result.foundation || {};

  if (foundation.villa_building_count < 1) failures.push(`Villa building ${VV_BUILDING_ID} was not found`);
  if (foundation.active_admin_user_count < 1) failures.push('No active admin_users row was found');
  if (foundation.user_count < 1) failures.push('No public.users row was found');

  const counts = result.counts || {};
  for (const [table, expected] of Object.entries(EXPECTED_COUNTS)) {
    const actual = Number(counts[table] ?? -1);
    if (allowExtraOperational) {
      if (actual < expected) failures.push(`${table}: expected at least ${expected} row(s), found ${actual}`);
    } else if (actual !== expected) {
      failures.push(`${table}: expected clean seed count ${expected}, found ${actual}`);
    }
  }

  const seeds = result.seeds || {};
  for (const [key, label] of Object.entries(SEED_CHECK_LABELS)) {
    if (!seeds[key]) failures.push(`Missing seed: ${label}`);
  }

  const pqrsLookup = result.pqrs_lookup || {};
  const pqrsRefs = Array.isArray(pqrsLookup.refs) ? pqrsLookup.refs : [];
  if (pqrsLookup.row_count !== 1 || pqrsRefs[0] !== 'VV-PQRS-E2E-000001') {
    failures.push(`lookup_pqrs_case returned ${pqrsLookup.row_count ?? 0} row(s): ${JSON.stringify(pqrsRefs)}`);
  }

  const md04 = result.md04 || {};
  if (Number(md04.open_finding_count || 0) < 1) {
    failures.push('get_md04_lite_exceptions is missing the seeded OPEN_FINDING example');
  }
  if (Number(md04.stock_out_count || 0) < 1) {
    failures.push('get_md04_lite_exceptions is missing the seeded STOCK_OUT example');
  }

  if (failures.length) {
    throw new Error(`Villa E2E seed verification failed:\n- ${failures.join('\n- ')}`);
  }
}

async function run(options) {
  const dbUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('POSTGRES_URL or DATABASE_URL is required for live DB verification');
  }

  const client = new PgWireClient(dbUrl, options);
  await client.connect();
  try {
    await client.query('BEGIN READ ONLY');
    const rows = await client.query(buildVerificationSql());
    await client.query('ROLLBACK');
    if (rows.length !== 1 || !rows[0].result) throw new Error('Verification query did not return one JSON result row');
    const result = JSON.parse(rows[0].result);
    assertResult(result, options);
    console.log('Foundation OK: Villa building, active admin user, and user rows exist.');
    console.log('Seed rows OK: all clean post-reset E2E examples were found.');
    console.log('PQRS lookup OK: VV-PQRS-E2E-000001 returned exactly itself.');
    console.log('MD04 OK: seeded OPEN_FINDING and STOCK_OUT examples are present.');
    if (options.allowExtraOperational) {
      console.log('Operational counts OK: seed rows are present; extra operational rows allowed.');
    } else {
      console.log('Operational counts OK: tracked tables still match the clean post-reset seed.');
    }
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback cleanup errors after a failed read-only verification.
    }
    throw error;
  } finally {
    client.close();
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    usage();
    return;
  }
  await run(options);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
