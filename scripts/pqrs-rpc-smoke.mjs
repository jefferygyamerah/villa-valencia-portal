#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const DEFAULT_FAKE_REF = 'VV-PQRS-NOTREAL-SMOKE';
const SQL_FILES = [
  'aproviva-suite/supabase/migrations/20260422120000_pqrs_cases.sql',
  'aproviva-suite/supabase/migrations/20260422200000_pqrs_cases_align_existing.sql',
  'scripts/ALL_VV_MIGRATIONS_ONE_PASTE.sql',
];

function usage() {
  console.log(`Usage: node scripts/pqrs-rpc-smoke.mjs [--check-sql] [--live] [--known-ref REF] [--fake-ref REF]

Non-mutating PQRS lookup cutover guard for Villa Valencia.

Default:
  Validates local SQL files define lookup_pqrs_case(p_case_ref text) and shows
  the Supabase RPC endpoint/body that should be used after the SQL is applied.

Options:
  --check-sql       Only validate local SQL files.
  --live            Call the Supabase lookup RPC with the public anon key.
  --known-ref REF   With --live, also assert REF returns itself.
  --fake-ref REF    Fake reference expected to return zero rows. Default: ${DEFAULT_FAKE_REF}
  --help            Show this help.

Live mode is read-only RPC smoke. It does not insert or update PQRS cases.`);
}

function readText(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

function getConfigValue(name) {
  const config = readText('js/config.js');
  const match = config.match(new RegExp(`${name}:\\s*'([^']+)'`));
  if (!match) throw new Error(`Could not read ${name} from js/config.js`);
  return match[1];
}

function assertSqlContract() {
  const failures = [];

  for (const file of SQL_FILES) {
    const sql = readText(file);
    if (!/lookup_pqrs_case\s*\(\s*p_case_ref\s+text\s*\)/i.test(sql)) {
      failures.push(`${file}: missing lookup_pqrs_case(p_case_ref text) signature`);
    }
    if (!/case_reference\s*=\s*trim\s*\(\s*p_case_ref\s*\)/i.test(sql)) {
      failures.push(`${file}: lookup predicate is not case_reference = trim(p_case_ref)`);
    }
    if (/lookup_pqrs_case\s*\(\s*case_ref\s+text\s*\)/i.test(sql)) {
      failures.push(`${file}: still defines ambiguous lookup_pqrs_case(case_ref text)`);
    }
  }

  if (failures.length) {
    throw new Error(`SQL contract check failed:\n- ${failures.join('\n- ')}`);
  }

  console.log('SQL contract OK: lookup_pqrs_case uses p_case_ref in all local migration bundles.');
}

function normalizeRef(value) {
  return String(value || '').trim().toUpperCase();
}

async function callLookup({ url, anonKey, caseRef }) {
  let response;
  try {
    response = await fetch(`${url}/rest/v1/rpc/lookup_pqrs_case`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ p_case_ref: caseRef }),
    });
  } catch (error) {
    const cause = error && error.cause ? `: ${error.cause.message || error.cause}` : '';
    throw new Error(`Lookup request failed${cause}`);
  }
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { response, body };
}

function rowsFromBody(body) {
  if (Array.isArray(body)) return body;
  if (body && typeof body === 'object') return [body];
  return [];
}

async function liveSmoke({ fakeRef, knownRef }) {
  const url = getConfigValue('SUPABASE_URL');
  const anonKey = getConfigValue('SUPABASE_ANON_KEY');

  const fake = await callLookup({ url, anonKey, caseRef: fakeRef });
  if (!fake.response.ok) {
    throw new Error(`Fake lookup failed with HTTP ${fake.response.status}: ${JSON.stringify(fake.body)}`);
  }
  const fakeRows = rowsFromBody(fake.body);
  if (fakeRows.length !== 0) {
    throw new Error(
      `Fake lookup returned ${fakeRows.length} row(s). The RPC fix is not live or is unsafe: ${JSON.stringify(fakeRows[0])}`,
    );
  }
  console.log(`Live fake lookup OK: ${fakeRef} returned zero rows.`);

  if (!knownRef) return;

  const known = await callLookup({ url, anonKey, caseRef: knownRef });
  if (!known.response.ok) {
    throw new Error(`Known lookup failed with HTTP ${known.response.status}: ${JSON.stringify(known.body)}`);
  }
  const knownRows = rowsFromBody(known.body);
  if (knownRows.length !== 1) {
    throw new Error(`Known lookup expected one row, got ${knownRows.length}.`);
  }
  const returnedRef = knownRows[0].case_reference || knownRows[0].case_ref;
  if (normalizeRef(returnedRef) !== normalizeRef(knownRef)) {
    throw new Error(`Known lookup returned ${returnedRef || '(blank)'} instead of ${knownRef}.`);
  }
  console.log(`Live known lookup OK: ${knownRef} returned itself.`);
}

async function main() {
  const args = process.argv.slice(2);
  const options = {
    checkSqlOnly: false,
    live: false,
    fakeRef: DEFAULT_FAKE_REF,
    knownRef: '',
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      usage();
      return;
    }
    if (arg === '--check-sql') {
      options.checkSqlOnly = true;
      continue;
    }
    if (arg === '--live') {
      options.live = true;
      continue;
    }
    if (arg === '--fake-ref') {
      options.fakeRef = args[++i] || '';
      continue;
    }
    if (arg === '--known-ref') {
      options.knownRef = args[++i] || '';
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  assertSqlContract();

  if (options.checkSqlOnly) return;

  const url = getConfigValue('SUPABASE_URL');
  console.log(`RPC endpoint: ${url}/rest/v1/rpc/lookup_pqrs_case`);
  console.log(`RPC body: ${JSON.stringify({ p_case_ref: options.fakeRef })}`);

  if (!options.live) {
    console.log('Dry run only. Add --live after applying SQL to verify the production RPC.');
    return;
  }

  await liveSmoke(options);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
