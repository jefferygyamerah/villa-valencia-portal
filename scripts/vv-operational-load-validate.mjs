#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const VV_BUILDING_ID = '88e6c11e-4a8c-4f39-a571-5f97e7f2b774';

const COLLECTIONS = [
  'inspection_plans',
  'inspection_plan_points',
  'inspection_rounds',
  'inspection_round_results',
  'inspection_findings',
  'incident_tickets',
  'work_assignments',
  'inventory_locations',
  'inventory_items',
  'inventory_movements',
  'service_listings',
  'documents',
  'weekly_reports',
  'spend_policies',
];

const ALLOWED = {
  planCategory: new Set(['operations', 'security', 'maintenance', 'cleanliness', 'inventory', 'vendor']),
  frequency: new Set(['daily', 'weekly', 'monthly', 'ad_hoc']),
  checkType: new Set(['boolean', 'qualitative', 'quantitative', 'photo_only']),
  roundStatus: new Set(['scheduled', 'in_progress', 'completed', 'closed', 'cancelled']),
  resultStatus: new Set(['ok', 'nok', 'not_checked', 'not_applicable']),
  findingStatus: new Set(['open', 'in_progress', 'resolved', 'closed']),
  incidentStatus: new Set(['received', 'in_progress', 'resolved', 'closed']),
  severity: new Set(['low', 'medium', 'high', 'critical']),
  workTaskType: new Set(['corrective', 'preventive', 'inspection', 'project']),
  workPriority: new Set(['low', 'normal', 'high', 'critical']),
  workStatus: new Set(['open', 'in_progress', 'blocked', 'completed', 'closed', 'cancelled']),
  movementType: new Set(['counted', 'received', 'issued', 'adjusted', 'transferred']),
  serviceStatus: new Set(['active', 'inactive', 'pending_review']),
  documentStatus: new Set(['active', 'archived', 'draft']),
  reportStatus: new Set(['draft', 'submitted', 'approved', 'archived']),
  spendStatus: new Set(['draft', 'active', 'retired']),
};

const REQUIRED = {
  inspection_plans: ['plan_code', 'name', 'category', 'frequency'],
  inspection_plan_points: ['plan_code', 'point_code', 'label', 'check_type'],
  inspection_rounds: ['round_number', 'title', 'status', 'scheduled_for'],
  inspection_round_results: ['round_number', 'point_code', 'result_status'],
  inspection_findings: ['finding_id', 'round_number', 'description', 'severity', 'status'],
  incident_tickets: ['ticket_number', 'title', 'category', 'location_label', 'severity', 'status'],
  work_assignments: ['assignment_number', 'title', 'area', 'assignee_name', 'task_type', 'priority', 'status'],
  inventory_locations: ['code', 'name'],
  inventory_items: ['sku', 'name', 'default_reorder_point'],
  inventory_movements: ['movement_id', 'inventory_item_sku', 'inventory_location_code', 'movement_type', 'quantity', 'balance_after', 'movement_at'],
  service_listings: ['provider_code', 'display_name', 'category', 'status'],
  documents: ['document_code', 'title', 'category', 'status'],
  weekly_reports: ['period_label', 'status'],
  spend_policies: ['policy_code', 'title', 'status'],
};

function usage() {
  console.log(`Usage: node scripts/vv-operational-load-validate.mjs --bundle FILE [--strict]
       node scripts/vv-operational-load-validate.mjs --dir DIRECTORY [--strict]

Offline validator for staged Villa Valencia operational data beyond PQRS.

This script only reads local JSON/CSV files. It does not call Supabase,
ph-management, Apps Script, Vercel, or any production API.

Options:
  --bundle FILE   JSON bundle with top-level arrays named after operational tables.
  --dir DIR       Directory with optional CSV files named <collection>.csv.
  --strict        Treat warnings as failures.
  --help          Show this help.

Safe fixture:
  node scripts/vv-operational-load-validate.mjs --bundle scripts/fixtures/operational-load-sample.json`);
}

function parseArgs(argv) {
  const options = { bundle: '', dir: '', strict: false, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--bundle') options.bundle = argv[++i] || '';
    else if (arg === '--dir') options.dir = argv[++i] || '';
    else if (arg === '--strict') options.strict = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!options.help && Number(Boolean(options.bundle)) + Number(Boolean(options.dir)) !== 1) {
    throw new Error('Provide exactly one of --bundle or --dir');
  }
  return options;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  const input = String(text).replace(/^\uFEFF/, '');

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
    if (ch === '"') inQuotes = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch !== '\r') {
      cell += ch;
    }
  }

  if (inQuotes) throw new Error('CSV parse failed: unterminated quoted value');
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((value) => String(value).trim() !== ''));
}

function normalizeHeader(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '');
}

function csvToObjects(file) {
  const rows = parseCsv(readFileSync(file, 'utf8'));
  if (!rows.length) return [];
  const headers = rows[0].map(normalizeHeader);
  const seen = new Set();
  for (const header of headers) {
    if (!header) throw new Error(`${file}: blank CSV header`);
    if (seen.has(header)) throw new Error(`${file}: duplicate CSV header ${header}`);
    seen.add(header);
  }
  return rows.slice(1).map((cells) => Object.fromEntries(headers.map((header, index) => [header, String(cells[index] || '').trim()])));
}

function emptyBundle() {
  return Object.fromEntries(COLLECTIONS.map((name) => [name, []]));
}

function loadBundle(options) {
  const bundle = emptyBundle();
  let source;
  let meta = {};

  if (options.bundle) {
    source = resolve(options.bundle);
    const parsed = JSON.parse(readFileSync(source, 'utf8'));
    meta = parsed.meta || {};
    for (const name of COLLECTIONS) {
      const rows = parsed[name] || [];
      if (!Array.isArray(rows)) throw new Error(`${name} must be an array`);
      bundle[name] = rows;
    }
    const unknown = Object.keys(parsed).filter((key) => key !== 'meta' && !COLLECTIONS.includes(key));
    return { source, meta, bundle, unknown };
  }

  source = resolve(options.dir);
  if (!existsSync(source) || !statSync(source).isDirectory()) throw new Error(`Not a directory: ${source}`);
  const files = new Map(readdirSync(source).filter((file) => file.endsWith('.csv')).map((file) => [basename(file, '.csv'), join(source, file)]));
  for (const name of COLLECTIONS) {
    if (files.has(name)) bundle[name] = csvToObjects(files.get(name));
  }
  const metaFile = join(source, 'meta.json');
  if (existsSync(metaFile)) meta = JSON.parse(readFileSync(metaFile, 'utf8'));
  const unknown = [...files.keys()].filter((name) => !COLLECTIONS.includes(name));
  return { source, meta, bundle, unknown };
}

function value(row, key) {
  const raw = row && row[key];
  if (raw === null || raw === undefined) return '';
  return String(raw).trim();
}

function objectValue(row, key) {
  return row && row[key] !== undefined ? row[key] : undefined;
}

function has(row, key) {
  return value(row, key) !== '';
}

function isValidDate(input) {
  if (!input) return true;
  const date = new Date(input);
  return Number.isFinite(date.getTime());
}

function isNumberLike(input) {
  if (input === null || input === undefined || input === '') return false;
  return Number.isFinite(Number(input));
}

function isJsonObject(input) {
  if (input === undefined || input === null || input === '') return true;
  if (typeof input === 'object' && !Array.isArray(input)) return true;
  try {
    const parsed = JSON.parse(String(input));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed);
  } catch {
    return false;
  }
}

function keyFor(collection, row) {
  if (collection === 'inspection_plans') return value(row, 'plan_code');
  if (collection === 'inspection_plan_points') return `${value(row, 'plan_code')}::${value(row, 'point_code')}`;
  if (collection === 'inspection_rounds') return value(row, 'round_number') || value(row, 'id');
  if (collection === 'inspection_round_results') return value(row, 'result_id') || `${value(row, 'round_number')}::${value(row, 'point_code')}`;
  if (collection === 'inspection_findings') return value(row, 'finding_id') || value(row, 'id');
  if (collection === 'incident_tickets') return value(row, 'ticket_number');
  if (collection === 'work_assignments') return value(row, 'assignment_number');
  if (collection === 'inventory_locations') return value(row, 'code');
  if (collection === 'inventory_items') return value(row, 'sku');
  if (collection === 'inventory_movements') return value(row, 'movement_id');
  if (collection === 'service_listings') return value(row, 'provider_code');
  if (collection === 'documents') return value(row, 'document_code');
  if (collection === 'weekly_reports') return value(row, 'period_label');
  if (collection === 'spend_policies') return value(row, 'policy_code');
  return '';
}

function addUnique(index, collection, row, rowNumber, errors) {
  const key = keyFor(collection, row);
  if (!key) return;
  if (!index[collection]) index[collection] = new Map();
  const normalized = key.toLowerCase();
  if (index[collection].has(normalized)) {
    errors.push(`${collection}[${rowNumber}]: duplicate key ${key} also appears on row ${index[collection].get(normalized)}`);
  } else {
    index[collection].set(normalized, rowNumber);
  }
}

function exists(index, collection, key) {
  if (!key) return true;
  return Boolean(index[collection] && index[collection].has(String(key).toLowerCase()));
}

function requiredFields(collection, row, rowNumber, errors) {
  for (const field of REQUIRED[collection] || []) {
    if (!has(row, field)) errors.push(`${collection}[${rowNumber}]: missing required field ${field}`);
  }
}

function allowed(collection, row, rowNumber, errors) {
  const checks = [
    ['category', ALLOWED.planCategory, collection === 'inspection_plans'],
    ['frequency', ALLOWED.frequency, collection === 'inspection_plans'],
    ['check_type', ALLOWED.checkType, collection === 'inspection_plan_points'],
    ['status', ALLOWED.roundStatus, collection === 'inspection_rounds'],
    ['result_status', ALLOWED.resultStatus, collection === 'inspection_round_results'],
    ['status', ALLOWED.findingStatus, collection === 'inspection_findings'],
    ['severity', ALLOWED.severity, collection === 'inspection_findings'],
    ['status', ALLOWED.incidentStatus, collection === 'incident_tickets'],
    ['severity', ALLOWED.severity, collection === 'incident_tickets'],
    ['task_type', ALLOWED.workTaskType, collection === 'work_assignments'],
    ['priority', ALLOWED.workPriority, collection === 'work_assignments'],
    ['status', ALLOWED.workStatus, collection === 'work_assignments'],
    ['movement_type', ALLOWED.movementType, collection === 'inventory_movements'],
    ['status', ALLOWED.serviceStatus, collection === 'service_listings'],
    ['status', ALLOWED.documentStatus, collection === 'documents'],
    ['status', ALLOWED.reportStatus, collection === 'weekly_reports'],
    ['status', ALLOWED.spendStatus, collection === 'spend_policies'],
  ];
  for (const [field, set, applies] of checks) {
    if (applies && has(row, field) && !set.has(value(row, field))) {
      errors.push(`${collection}[${rowNumber}]: ${field} "${value(row, field)}" is not one of ${[...set].join(', ')}`);
    }
  }
}

function dateAndJsonChecks(collection, row, rowNumber, errors) {
  for (const field of ['created_at', 'updated_at', 'scheduled_for', 'started_at', 'completed_at', 'checked_at', 'due_at', 'movement_at', 'submitted_at', 'effective_from', 'effective_to']) {
    if (has(row, field) && !isValidDate(value(row, field))) {
      errors.push(`${collection}[${rowNumber}]: ${field} is not parseable (${value(row, field)})`);
    }
  }
  if (objectValue(row, 'metadata') !== undefined && !isJsonObject(objectValue(row, 'metadata'))) {
    errors.push(`${collection}[${rowNumber}]: metadata must be a JSON object`);
  }
}

function numericChecks(collection, row, rowNumber, errors) {
  const numericByCollection = {
    inspection_plans: ['expected_duration_minutes'],
    inspection_plan_points: ['sort_order'],
    inventory_items: ['default_reorder_point'],
    inventory_movements: ['quantity', 'balance_after'],
    spend_policies: ['limit_amount'],
  };
  for (const field of numericByCollection[collection] || []) {
    if (has(row, field) && !isNumberLike(value(row, field))) {
      errors.push(`${collection}[${rowNumber}]: ${field} must be numeric`);
    }
  }
}

function buildingCheck(collection, row, rowNumber, errors) {
  if (has(row, 'building_id') && value(row, 'building_id') !== VV_BUILDING_ID) {
    errors.push(`${collection}[${rowNumber}]: building_id must be blank or ${VV_BUILDING_ID}, got ${value(row, 'building_id')}`);
  }
}

function privacyWarnings(collection, row, rowNumber, warnings) {
  const textFields = ['title', 'description', 'notes', 'details', 'assignee_name', 'display_name', 'contact_name', 'email', 'phone'];
  const emailPattern = /[^\s@]+@[^\s@]+\.[^\s@]+/;
  const phonePattern = /(?:\+?\d[\s().-]*){8,}/;
  for (const field of textFields) {
    const text = value(row, field);
    if (!text) continue;
    if (emailPattern.test(text)) warnings.push(`${collection}[${rowNumber}]: ${field} appears to contain an email address`);
    if (phonePattern.test(text)) warnings.push(`${collection}[${rowNumber}]: ${field} appears to contain a phone-like number`);
  }
}

function buildIndex(bundle, errors) {
  const index = {};
  for (const collection of COLLECTIONS) {
    bundle[collection].forEach((row, offset) => addUnique(index, collection, row, offset + 1, errors));
  }
  return index;
}

function crossReferenceChecks(bundle, index, errors, warnings) {
  bundle.inspection_plan_points.forEach((row, offset) => {
    if (!exists(index, 'inspection_plans', value(row, 'plan_code'))) {
      errors.push(`inspection_plan_points[${offset + 1}]: plan_code ${value(row, 'plan_code')} has no matching inspection_plans row`);
    }
  });

  bundle.inspection_rounds.forEach((row, offset) => {
    if (has(row, 'plan_code') && !exists(index, 'inspection_plans', value(row, 'plan_code'))) {
      warnings.push(`inspection_rounds[${offset + 1}]: plan_code ${value(row, 'plan_code')} has no staged inspection plan`);
    }
  });

  bundle.inspection_round_results.forEach((row, offset) => {
    const rowNumber = offset + 1;
    if (!exists(index, 'inspection_rounds', value(row, 'round_number'))) {
      errors.push(`inspection_round_results[${rowNumber}]: round_number ${value(row, 'round_number')} has no matching inspection_rounds row`);
    }
    const pointKey = `${value(row, 'plan_code')}::${value(row, 'point_code')}`;
    if (has(row, 'plan_code') && !exists(index, 'inspection_plan_points', pointKey)) {
      errors.push(`inspection_round_results[${rowNumber}]: point ${pointKey} has no matching inspection_plan_points row`);
    }
  });

  bundle.inspection_findings.forEach((row, offset) => {
    const rowNumber = offset + 1;
    if (!exists(index, 'inspection_rounds', value(row, 'round_number'))) {
      errors.push(`inspection_findings[${rowNumber}]: round_number ${value(row, 'round_number')} has no matching inspection_rounds row`);
    }
    const pointKey = `${value(row, 'plan_code')}::${value(row, 'point_code')}`;
    if (has(row, 'point_code') && has(row, 'plan_code') && !exists(index, 'inspection_plan_points', pointKey)) {
      errors.push(`inspection_findings[${rowNumber}]: point ${pointKey} has no matching inspection_plan_points row`);
    }
  });

  for (const collection of ['incident_tickets', 'work_assignments']) {
    bundle[collection].forEach((row, offset) => {
      const rowNumber = offset + 1;
      if (has(row, 'inspection_finding_id') && !exists(index, 'inspection_findings', value(row, 'inspection_finding_id'))) {
        warnings.push(`${collection}[${rowNumber}]: inspection_finding_id ${value(row, 'inspection_finding_id')} is not in the staged findings bundle`);
      }
      if (has(row, 'round_number') && !exists(index, 'inspection_rounds', value(row, 'round_number'))) {
        warnings.push(`${collection}[${rowNumber}]: round_number ${value(row, 'round_number')} is not in the staged rounds bundle`);
      }
    });
  }

  bundle.inventory_movements.forEach((row, offset) => {
    const rowNumber = offset + 1;
    if (!exists(index, 'inventory_items', value(row, 'inventory_item_sku'))) {
      errors.push(`inventory_movements[${rowNumber}]: inventory_item_sku ${value(row, 'inventory_item_sku')} has no matching inventory_items row`);
    }
    if (!exists(index, 'inventory_locations', value(row, 'inventory_location_code'))) {
      errors.push(`inventory_movements[${rowNumber}]: inventory_location_code ${value(row, 'inventory_location_code')} has no matching inventory_locations row`);
    }
  });
}

function validate(loaded, { strict }) {
  const errors = [];
  const warnings = [];

  if (loaded.meta.building_id && loaded.meta.building_id !== VV_BUILDING_ID) {
    errors.push(`meta.building_id must be ${VV_BUILDING_ID}, got ${loaded.meta.building_id}`);
  }
  for (const unknown of loaded.unknown || []) {
    warnings.push(`Ignoring unrecognized top-level collection/file: ${unknown}`);
  }

  for (const collection of COLLECTIONS) {
    loaded.bundle[collection].forEach((row, offset) => {
      const rowNumber = offset + 1;
      requiredFields(collection, row, rowNumber, errors);
      allowed(collection, row, rowNumber, errors);
      dateAndJsonChecks(collection, row, rowNumber, errors);
      numericChecks(collection, row, rowNumber, errors);
      buildingCheck(collection, row, rowNumber, errors);
      privacyWarnings(collection, row, rowNumber, warnings);
    });
  }

  const index = buildIndex(loaded.bundle, errors);
  crossReferenceChecks(loaded.bundle, index, errors, warnings);

  const loadedRows = COLLECTIONS.reduce((sum, collection) => sum + loaded.bundle[collection].length, 0);
  if (!loadedRows) errors.push('No staged operational rows found');
  if (strict && warnings.length) errors.push(...warnings.map((warning) => `Strict warning: ${warning}`));

  return {
    errors,
    warnings,
    rowCounts: Object.fromEntries(COLLECTIONS.map((collection) => [collection, loaded.bundle[collection].length])),
    totalRows: loadedRows,
  };
}

function printReport(result, source) {
  if (result.errors.length) {
    console.error('Villa Valencia operational load bundle FAILED');
    console.error(`Source: ${source}`);
    for (const error of result.errors) console.error(`- ${error}`);
    if (result.warnings.length) {
      console.error('\nWarnings:');
      for (const warning of result.warnings) console.error(`- ${warning}`);
    }
    process.exit(1);
  }

  console.log('Villa Valencia operational load bundle OK: no production data was touched.');
  console.log(`Source: ${source}`);
  console.log(`Rows: ${result.totalRows}`);
  console.log('Collections:');
  for (const [collection, count] of Object.entries(result.rowCounts).filter(([, count]) => count > 0)) {
    console.log(`  ${collection}: ${count}`);
  }
  if (result.warnings.length) {
    console.log('\nWarnings:');
    for (const warning of result.warnings) console.log(`- ${warning}`);
  }
  console.log('\nNext gate: private source exports plus explicit Jeff approval before any import or live DB mutation.');
}

try {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    usage();
  } else {
    const loaded = loadBundle(options);
    printReport(validate(loaded, options), loaded.source);
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
