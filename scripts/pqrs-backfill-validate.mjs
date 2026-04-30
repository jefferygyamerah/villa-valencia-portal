#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const VV_BUILDING_ID = '88e6c11e-4a8c-4f39-a571-5f97e7f2b774';
const ALLOWED_STATUSES = new Set(['recibido', 'en_progreso', 'resuelto', 'cerrado']);

const FIELD_ALIASES = {
  case_reference: ['case_reference', 'case_ref', 'reference', 'casereference', 'caseid', 'case_id', 'referencia'],
  subject: ['subject', 'title', 'summary', 'resumen', 'asunto'],
  description: ['description', 'descripcion', 'details', 'body', 'message', 'detalle'],
  status: ['status', 'estado'],
  building_id: ['building_id', 'buildingid'],
  email: ['email', 'correo', 'correo_electronico'],
  created_at: ['created_at', 'createdat', 'created', 'fecha_creacion'],
  updated_at: ['updated_at', 'updatedat', 'updated', 'fecha_actualizacion'],
  metadata: ['metadata', 'meta'],
};

function usage() {
  console.log(`Usage: node scripts/pqrs-backfill-validate.mjs --file CSV [--strict]

Offline validator for a staged ph-management -> Villa Valencia PQRS backfill CSV.

This script only reads a local CSV file. It does not call Supabase, ph-management,
or any production API.

Expected staged import columns:
  case_reference, subject, description, location, email, site_place_id,
  zona_label, tipo, urgencia, casa, status, created_at, updated_at, metadata

Accepted aliases for common export headers include case_ref/reference, resumen,
asunto, descripcion, estado, correo, createdAt, and updatedAt.

Options:
  --file CSV   CSV file to validate.
  --strict     Treat warnings as failures.
  --help       Show this help.`);
}

function parseArgs(argv) {
  const options = { file: '', strict: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    if (arg === '--file') {
      options.file = argv[++i] || '';
      continue;
    }
    if (arg === '--strict') {
      options.strict = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!options.help && !options.file) {
    throw new Error('--file is required');
  }

  return options;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  const input = text.replace(/^\uFEFF/, '');

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    const next = input[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      row.push(cell);
      cell = '';
      continue;
    }
    if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    if (ch === '\r') {
      continue;
    }

    cell += ch;
  }

  if (inQuotes) {
    throw new Error('CSV parse failed: unterminated quoted value');
  }

  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((value) => String(value).trim() !== ''));
}

function normalizeHeader(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function buildHeaderMap(headers) {
  const map = new Map();
  const seen = new Set();

  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header);
    if (!normalized) return;
    if (seen.has(normalized)) {
      throw new Error(`Duplicate CSV header after normalization: ${header}`);
    }
    seen.add(normalized);
    map.set(normalized, index);
  });

  return map;
}

function indexFor(headerMap, field) {
  const aliases = FIELD_ALIASES[field] || [field];
  for (const alias of aliases) {
    const index = headerMap.get(normalizeHeader(alias));
    if (index !== undefined) return index;
  }
  return -1;
}

function getValue(row, indexes, field) {
  const index = indexes[field];
  if (index === undefined || index < 0) return '';
  return String(row[index] || '').trim();
}

function getRawValue(row, indexes, field) {
  const index = indexes[field];
  if (index === undefined || index < 0) return '';
  return String(row[index] || '');
}

function isValidDate(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime());
}

function isLikelyEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validateCsv(file, { strict }) {
  const csv = readFileSync(resolve(file), 'utf8');
  const rows = parseCsv(csv);
  if (rows.length < 2) {
    throw new Error('CSV must include a header row and at least one data row');
  }

  const headers = rows[0].map((header) => String(header || '').trim());
  const headerMap = buildHeaderMap(headers);
  const indexes = Object.fromEntries(
    Object.keys(FIELD_ALIASES).map((field) => [field, indexFor(headerMap, field)]),
  );

  const errors = [];
  const warnings = [];
  const refs = new Map();
  const statusCounts = new Map();
  const samples = [];

  if (indexes.case_reference < 0) {
    errors.push('Missing case_reference column or accepted alias');
  }
  if (indexes.subject < 0 && indexes.description < 0) {
    errors.push('Missing subject/description columns or accepted aliases');
  }

  rows.slice(1).forEach((row, offset) => {
    const rowNumber = offset + 2;
    const rawCaseReference = getRawValue(row, indexes, 'case_reference');
    const caseReference = rawCaseReference.trim();
    const subject = getValue(row, indexes, 'subject');
    const description = getValue(row, indexes, 'description');
    const status = getValue(row, indexes, 'status') || 'recibido';
    const buildingId = getValue(row, indexes, 'building_id');
    const email = getValue(row, indexes, 'email');
    const createdAt = getValue(row, indexes, 'created_at');
    const updatedAt = getValue(row, indexes, 'updated_at');
    const metadata = getValue(row, indexes, 'metadata');

    if (!caseReference) {
      errors.push(`Row ${rowNumber}: missing case_reference`);
    } else {
      const normalizedRef = caseReference.toUpperCase();
      if (refs.has(normalizedRef)) {
        errors.push(`Row ${rowNumber}: duplicate case_reference ${caseReference} also appears on row ${refs.get(normalizedRef)}`);
      } else {
        refs.set(normalizedRef, rowNumber);
        if (samples.length < 3) samples.push(caseReference);
      }
      if (!/PQRS/i.test(caseReference)) {
        warnings.push(`Row ${rowNumber}: case_reference does not contain PQRS (${caseReference})`);
      }
      if (caseReference !== rawCaseReference) {
        warnings.push(`Row ${rowNumber}: case_reference has surrounding whitespace`);
      }
    }

    if (!subject && !description) {
      warnings.push(`Row ${rowNumber}: both subject and description are blank`);
    }
    if (!ALLOWED_STATUSES.has(status)) {
      errors.push(`Row ${rowNumber}: status "${status}" is not one of ${Array.from(ALLOWED_STATUSES).join(', ')}`);
    }
    if (buildingId && buildingId !== VV_BUILDING_ID) {
      errors.push(`Row ${rowNumber}: building_id must be blank or ${VV_BUILDING_ID}, got ${buildingId}`);
    }
    if (email && !isLikelyEmail(email)) {
      warnings.push(`Row ${rowNumber}: email is not in a normal address format (${email})`);
    }
    if (createdAt && !isValidDate(createdAt)) {
      errors.push(`Row ${rowNumber}: created_at is not parseable (${createdAt})`);
    }
    if (updatedAt && !isValidDate(updatedAt)) {
      errors.push(`Row ${rowNumber}: updated_at is not parseable (${updatedAt})`);
    }
    if (metadata) {
      try {
        const parsed = JSON.parse(metadata);
        if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
          errors.push(`Row ${rowNumber}: metadata must be a JSON object`);
        }
      } catch {
        errors.push(`Row ${rowNumber}: metadata is not valid JSON`);
      }
    }

    statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
  });

  if (strict && warnings.length) {
    errors.push(...warnings.map((warning) => `Strict warning: ${warning}`));
  }

  return {
    errors,
    warnings,
    rowCount: rows.length - 1,
    statusCounts,
    samples,
  };
}

function printResult(result) {
  if (result.errors.length) {
    console.error('PQRS backfill CSV FAILED');
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
    if (result.warnings.length) {
      console.error('\nWarnings:');
      for (const warning of result.warnings) console.error(`- ${warning}`);
    }
    process.exit(1);
  }

  console.log('PQRS backfill CSV OK: no production data was touched.');
  console.log(`Rows: ${result.rowCount}`);
  console.log('Status counts:');
  for (const [status, count] of [...result.statusCounts.entries()].sort()) {
    console.log(`  ${status}: ${count}`);
  }
  if (result.samples.length) {
    console.log(`Known-ref smoke candidate: node scripts/pqrs-rpc-smoke.mjs --live --known-ref ${result.samples[0]}`);
  }
  if (result.warnings.length) {
    console.log('\nWarnings:');
    for (const warning of result.warnings) console.log(`- ${warning}`);
  }
}

try {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    usage();
  } else {
    printResult(validateCsv(options.file, options));
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
