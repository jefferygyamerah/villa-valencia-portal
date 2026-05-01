#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const DEFAULT_MIGRATION = 'aproviva-suite/supabase/migrations/20260429120000_inspection_plan_data_backbone.sql';
const VV_BUILDING_ID = '88e6c11e-4a8c-4f39-a571-5f97e7f2b774';

const BASE_TABLE_CONTRACTS = [
  {
    table: 'inspection_rounds',
    columns: ['id', 'status', 'title', 'area', 'scheduled_for', 'created_at', 'round_number'],
    reason: 'MD04 overdue recorrido exceptions',
  },
  {
    table: 'inspection_findings',
    columns: ['id', 'building_id', 'severity', 'status', 'description', 'zona_label', 'created_at', 'inspection_round_id'],
    reason: 'MD04 open/critical finding exceptions',
  },
  {
    table: 'work_assignments',
    columns: ['id', 'title', 'area', 'priority', 'status', 'due_at', 'created_at', 'assignment_number'],
    reason: 'MD04 overdue work/vendor exceptions',
  },
  {
    table: 'inventory_movements',
    columns: ['inventory_item_id', 'inventory_location_id', 'balance_after', 'movement_at'],
    reason: 'MD04 inventory latest-balance exceptions',
  },
  {
    table: 'inventory_items',
    columns: ['id', 'name', 'sku', 'default_reorder_point', 'is_active', 'created_at'],
    reason: 'MD04 stock-out/reorder exceptions',
  },
  {
    table: 'inventory_locations',
    columns: ['id', 'name'],
    reason: 'MD04 inventory area labels',
  },
];

const LOCAL_CONTRACTS = [
  {
    label: 'creates inspection_plans additively',
    pattern: /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.inspection_plans/i,
  },
  {
    label: 'creates inspection_plan_points additively',
    pattern: /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.inspection_plan_points/i,
  },
  {
    label: 'creates inspection_round_results additively',
    pattern: /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.inspection_round_results/i,
  },
  {
    label: 'bridges inspection_rounds with nullable plan columns',
    pattern: /ALTER\s+TABLE\s+public\.inspection_rounds\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+inspection_plan_id\s+uuid/i,
  },
  {
    label: 'bridges inspection_findings with nullable result columns',
    pattern: /ALTER\s+TABLE\s+public\.inspection_findings\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+inspection_round_result_id\s+uuid/i,
  },
  {
    label: 'seeds only the Villa Valencia building id',
    pattern: new RegExp(VV_BUILDING_ID.replace(/-/g, '\\-'), 'i'),
  },
  {
    label: 'seeds daily security plan',
    pattern: /'VV-SEC-DAILY'/,
  },
  {
    label: 'seeds weekly wet-areas plan',
    pattern: /'VV-WET-WEEKLY'/,
  },
  {
    label: 'keeps plan seed idempotent',
    pattern: /ON\s+CONFLICT\s*\(\s*building_id\s*,\s*plan_code\s*\)\s+DO\s+UPDATE/i,
  },
  {
    label: 'keeps point seed idempotent',
    pattern: /ON\s+CONFLICT\s*\(\s*plan_id\s*,\s*point_code\s*\)\s+DO\s+UPDATE/i,
  },
  {
    label: 'creates MD04-lite view',
    pattern: /CREATE\s+VIEW\s+public\.v_md04_lite_exceptions\s+AS/i,
  },
  {
    label: 'creates MD04-lite RPC',
    pattern: /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.get_md04_lite_exceptions\s*\(\s*p_building_id\s+uuid\s+DEFAULT\s+NULL\s*\)/i,
  },
  {
    label: 'grants read-only MD04 RPC execution to portal roles',
    pattern: /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.get_md04_lite_exceptions\s*\(\s*uuid\s*\)\s+TO\s+anon\s*,\s*authenticated/i,
  },
];

const FORBIDDEN_PATTERNS = [
  { label: 'DROP TABLE', pattern: /\bDROP\s+TABLE\b/i },
  { label: 'TRUNCATE', pattern: /\bTRUNCATE\b/i },
  { label: 'DELETE FROM', pattern: /\bDELETE\s+FROM\b/i },
  { label: 'DROP COLUMN', pattern: /\bALTER\s+TABLE\b[\s\S]*?\bDROP\s+COLUMN\b/i },
];

function usage() {
  console.log(`Usage: node scripts/recorridos-md04-preflight.mjs [--live] [--print-sql] [--migration PATH] [--timeout-ms MS]

Non-mutating guard for the Villa Valencia recorridos/MD04-lite data-backbone migration.

Default:
  Validates the local migration contract and prints the production prerequisite
  table/column contract needed before applying the SQL in Supabase.

Options:
  --live          Read-only Supabase REST probes with limit=0 for required tables/columns.
  --print-sql     Print read-only Supabase SQL that Jeff/admin can run before approval.
  --migration     Migration path to validate. Default: ${DEFAULT_MIGRATION}
  --timeout-ms    Timeout per live table probe. Default: 10000.
  --help          Show this help.

This script never inserts, updates, deletes, imports, or creates production rows/files.`);
}

function readText(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

function parseConfigValue(file, name) {
  const text = readText(file);
  const match = text.match(new RegExp(`${name}:\\s*'([^']+)'`));
  if (!match) throw new Error(`Could not read ${name} from ${file}`);
  return match[1];
}

function parseArgs(argv) {
  const options = {
    live: false,
    printSql: false,
    migration: DEFAULT_MIGRATION,
    timeoutMs: 10000,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    if (arg === '--live') {
      options.live = true;
      continue;
    }
    if (arg === '--print-sql') {
      options.printSql = true;
      continue;
    }
    if (arg === '--migration') {
      options.migration = argv[++i] || '';
      continue;
    }
    if (arg === '--timeout-ms') {
      options.timeoutMs = Number(argv[++i] || 0);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!options.migration) throw new Error('--migration requires a path');
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new Error('--timeout-ms must be a positive number');
  }

  return options;
}

function assertLocalMigrationContract(migrationPath) {
  const sql = readText(migrationPath);
  const failures = [];

  for (const contract of LOCAL_CONTRACTS) {
    if (!contract.pattern.test(sql)) failures.push(`missing: ${contract.label}`);
  }

  for (const forbidden of FORBIDDEN_PATTERNS) {
    if (forbidden.pattern.test(sql)) failures.push(`unsafe operation present: ${forbidden.label}`);
  }

  const missingBaseRefs = BASE_TABLE_CONTRACTS
    .filter(({ table }) => !new RegExp(`public\\.${table}\\b`, 'i').test(sql))
    .map(({ table }) => table);
  if (missingBaseRefs.length) {
    failures.push(`MD04 view does not reference expected base tables: ${missingBaseRefs.join(', ')}`);
  }

  const uuidLiterals = Array.from(sql.matchAll(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi))
    .map((match) => match[0].toLowerCase());
  const nonVillaIds = uuidLiterals.filter((id) => id !== VV_BUILDING_ID);
  if (nonVillaIds.length) {
    failures.push(`unexpected non-Villa-Valencia UUID literal(s): ${[...new Set(nonVillaIds)].join(', ')}`);
  }

  if (failures.length) {
    throw new Error(`MD04 local migration contract failed:\n- ${failures.join('\n- ')}`);
  }

  console.log(`MD04 local migration contract OK: ${migrationPath}`);
  console.log(`Villa Valencia seed guard OK: ${VV_BUILDING_ID}`);
}

function printBaseTableContract() {
  console.log('Required existing production table/column contract before apply:');
  for (const { table, columns, reason } of BASE_TABLE_CONTRACTS) {
    console.log(`- ${table}: ${columns.join(', ')} (${reason})`);
  }
}

function buildPrereqSql(migrationPath) {
  const rows = BASE_TABLE_CONTRACTS
    .flatMap(({ table, columns }) => columns.map((column) => `  ('${table}', '${column}')`))
    .join(',\n');

  return `-- Read-only MD04/data-backbone prerequisite check.
-- Run in the Villa Valencia Supabase project before applying
-- ${migrationPath}.
WITH required(table_name, column_name) AS (
  VALUES
${rows}
),
checks AS (
  SELECT
    r.table_name,
    r.column_name,
    to_regclass('public.' || r.table_name) IS NOT NULL AS table_exists,
    EXISTS (
      SELECT 1
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = r.table_name
        AND c.column_name = r.column_name
    ) AS column_exists
  FROM required r
)
SELECT table_name, column_name, table_exists, column_exists
FROM checks
WHERE NOT table_exists OR NOT column_exists
ORDER BY table_name, column_name;

-- Expected result before approval/apply: zero rows.`;
}

async function fetchWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function probeTable({ supabaseUrl, anonKey, table, columns, timeoutMs }) {
  const params = new URLSearchParams({
    select: columns.join(','),
    limit: '0',
  });
  const url = `${supabaseUrl}/rest/v1/${table}?${params}`;
  let response;
  try {
    response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    }, timeoutMs);
  } catch (error) {
    const cause = error && error.cause ? `: ${error.cause.message || error.cause}` : '';
    throw new Error(`${table}: request failed${cause || `: ${error.message || error}`}`);
  }

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${table}: HTTP ${response.status} for columns ${columns.join(', ')}: ${text}`);
  }
  console.log(`Live prerequisite OK: ${table} exposes ${columns.length} required column(s).`);
}

async function livePrereqSmoke(timeoutMs) {
  const supabaseUrl = parseConfigValue('aproviva-suite/js/config.js', 'SUPABASE_URL');
  const anonKey = parseConfigValue('aproviva-suite/js/config.js', 'SUPABASE_PUBLIC_KEY');

  for (const contract of BASE_TABLE_CONTRACTS) {
    await probeTable({ supabaseUrl, anonKey, timeoutMs, ...contract });
  }

  console.log('Live MD04 prerequisite smoke OK: no writes performed.');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    usage();
    return;
  }

  assertLocalMigrationContract(options.migration);
  printBaseTableContract();

  if (options.printSql) {
    console.log('\n' + buildPrereqSql(options.migration));
  }

  if (options.live) {
    await livePrereqSmoke(options.timeoutMs);
  } else {
    console.log('Dry run only. Add --live for read-only Supabase REST prerequisite probes.');
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
