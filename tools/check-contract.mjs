// Checks the things seven people would otherwise check by eye, every time, and get wrong once:
//
//   1. The sheet column order in docs/sheet-template.md matches BOOKINGS_COLUMNS and
//      SERVICES_COLUMNS in shared/contract.ts, in the same order. The backend writes rows by
//      that array and the owner builds the sheet from that document; if they drift, bookings land
//      in the wrong column and nothing fails loudly.
//   2. The tab names in the contract appear in the handover document the owner follows.
//   3. Every JSON file we ship parses, so a trailing comma never reaches Pages.
//   4. src/assets/config.json carries exactly the three expected keys and nothing else. The
//      extra-key check is the point: this file is fetched by the browser, so a `clientSecret` or
//      `apiKey` added here would ship a credential in a public bundle. A filled-in config is
//      fine — that is how the site goes live.
//
// Run: npm run check:contract (also runs inside npm run verify)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from './dist-dir.mjs';

const failures = [];
const read = (relativePath) => readFileSync(join(REPO_ROOT, relativePath), 'utf8');

function fail(message) {
  failures.push(message);
}

function stringArrayConst(source, name) {
  const match = new RegExp(`${name}\\s*=\\s*\\[([^\\]]*)\\]`, 's').exec(source);
  if (!match) {
    fail(`shared/contract.ts: could not find the ${name} array — did it get renamed?`);
    return null;
  }
  return [...match[1].matchAll(/'([^']+)'/g)].map((entry) => entry[1]);
}

// Column names as the sheet-template document spells them: leading cells of its markdown tables,
// written as `| A   | \`booking_id\` | ...`.
function documentedColumns(markdown, heading) {
  const section = markdown.split(/^## /m).find((part) => part.startsWith(heading));
  if (!section) {
    fail(`docs/sheet-template.md: no section found for "${heading}"`);
    return null;
  }
  return [...section.matchAll(/^\|\s*[A-Z]\s*\|\s*`([a-z_]+)`\s*\|/gm)].map((row) => row[1]);
}

function compare(label, expected, actual) {
  if (!expected || !actual) {
    return;
  }
  if (expected.join(',') !== actual.join(',')) {
    fail(
      `${label} drifted.\n    shared/contract.ts: ${expected.join(', ')}\n    docs/sheet-template.md: ${actual.join(', ')}`
    );
  }
}

const contract = read('shared/contract.ts');
const sheetTemplate = read('docs/sheet-template.md');

compare(
  'Bookings column order',
  stringArrayConst(contract, 'BOOKINGS_COLUMNS'),
  documentedColumns(sheetTemplate, 'Tab 1')
);
compare(
  'Services column order',
  stringArrayConst(contract, 'SERVICES_COLUMNS'),
  documentedColumns(sheetTemplate, 'Tab 2')
);

for (const tab of [...contract.matchAll(/^\s*\w+: '([^']+)',$/gm)]
  .map((entry) => entry[1])
  .filter((value) => /^[A-Z]/.test(value))) {
  if (!sheetTemplate.includes(`\`${tab}\``)) {
    fail(`docs/sheet-template.md does not mention the tab name \`${tab}\` from SHEET_TAB_NAMES`);
  }
}

const jsonFiles = [
  'src/assets/config.json',
  'src/assets/config.example.json',
  'src/assets/fixtures/busy.json',
  'src/data/services.json',
  'src/data/hours.json',
  'apps-script/src/appsscript.json',
  '.clasp.json',
  'angular.json',
  'package.json',
];

const parsed = new Map();
for (const file of jsonFiles) {
  try {
    parsed.set(file, JSON.parse(read(file)));
  } catch (error) {
    fail(`${file} is not valid JSON: ${error.message}`);
  }
}

const CONFIG_KEYS = ['auth0Domain', 'auth0ClientId', 'apiBaseUrl'];
for (const file of ['src/assets/config.json', 'src/assets/config.example.json']) {
  const config = parsed.get(file);
  if (!config) {
    continue;
  }
  const keys = Object.keys(config).sort();
  const expected = [...CONFIG_KEYS].sort();
  if (keys.join(',') !== expected.join(',')) {
    fail(
      `${file} must carry exactly these keys and no others: ${expected.join(', ')} (found: ${keys.join(', ') || 'none'}). This file is fetched by the browser — an extra key is how a credential ends up in a public bundle.`
    );
  }
}

const busy = parsed.get('src/assets/fixtures/busy.json');
if (busy && (busy.ok !== true || typeof busy.date !== 'string' || !Array.isArray(busy.busy))) {
  fail(
    'src/assets/fixtures/busy.json must be a valid AvailabilityResponse: { ok: true, date, busy[] }'
  );
}

if (failures.length > 0) {
  console.error(`check:contract found ${failures.length} problem(s):\n`);
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

console.log('check:contract: sheet columns, tab names, shipped JSON and config keys all agree');
