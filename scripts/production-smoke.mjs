#!/usr/bin/env node

const DEFAULT_BASE_URL = 'https://villavalencia.vercel.app';
const DEFAULT_TIMEOUT_MS = 15000;

const ROUTES = [
  '/',
  '/js/config.js',
  '/aproviva-suite/index.html',
  '/aproviva-suite/mapa-pqrs.html',
  '/proveedores.html',
];

function usage() {
  console.log(`Usage: node scripts/production-smoke.mjs [--base-url URL] [--timeout-ms MS]

Non-mutating production HTTP/config smoke for Villa Valencia.

Checks:
  - Core production routes return HTTP 200.
  - /js/config.js is the Villa Valencia build, not the ph-management fallback.
  - Production config has PQRS_USE_VV_SUPABASE: true.

This script only performs GET/HEAD requests. It does not submit PQRS cases or write data.`);
}

function parseArgs(argv) {
  const options = {
    baseUrl: DEFAULT_BASE_URL,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    if (arg === '--base-url') {
      options.baseUrl = argv[++i] || '';
      continue;
    }
    if (arg === '--timeout-ms') {
      options.timeoutMs = Number(argv[++i] || 0);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!options.baseUrl) throw new Error('--base-url requires a URL');
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new Error('--timeout-ms must be a positive number');
  }

  options.baseUrl = options.baseUrl.replace(/\/+$/, '');
  return options;
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

async function assertRoute({ baseUrl, route, timeoutMs }) {
  const url = `${baseUrl}${route}`;
  const response = await fetchWithTimeout(url, { method: 'HEAD', redirect: 'follow' }, timeoutMs);
  if (!response.ok) {
    throw new Error(`${route} returned HTTP ${response.status}`);
  }
  console.log(`HTTP OK: ${route} -> ${response.status}`);
}

async function assertConfig({ baseUrl, timeoutMs }) {
  const response = await fetchWithTimeout(`${baseUrl}/js/config.js`, { method: 'GET' }, timeoutMs);
  if (!response.ok) {
    throw new Error(`/js/config.js GET returned HTTP ${response.status}`);
  }

  const text = await response.text();
  const checks = [
    {
      label: 'Villa Supabase URL present',
      ok: /SUPABASE_URL:\s*'https:\/\/tgoitmwdpdkhlpqpwrvs\.supabase\.co'/.test(text),
    },
    {
      label: 'PQRS_USE_VV_SUPABASE is true',
      ok: /PQRS_USE_VV_SUPABASE:\s*true/.test(text),
    },
    {
      label: 'legacy ph-management fallback retained only for rollback',
      ok: /PQRS_USE_VV_SUPABASE:\s*true/.test(text) && /PH_MANAGEMENT_API_BASE:\s*'https:\/\/ph-management\.vercel\.app'/.test(text),
    },
  ];

  for (const check of checks) {
    if (!check.ok) throw new Error(`Config check failed: ${check.label}`);
    console.log(`Config OK: ${check.label}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    usage();
    return;
  }

  for (const route of ROUTES) {
    await assertRoute({ ...options, route });
  }
  await assertConfig(options);
  console.log('Production smoke OK: no writes performed.');
}

main().catch((error) => {
  const cause = error && error.cause ? `: ${error.cause.message || error.cause}` : '';
  console.error(`${error.message}${cause}`);
  process.exit(1);
});
