// Fails the build if a credential ended up in the thing that actually ships: the browser bundle.
// The browser holds no credential that touches the sheet by design (see DEPLOYMENT.md) — this
// is the check that catches the day someone pastes a real key into a fixture or a config file and
// forgets to take it back out before `npm run build`.
//
// Run: node tools/check-no-secrets.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { BROWSER_DIST_DIR, REPO_ROOT } from './dist-dir.mjs';

const findings = [];

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      yield* walk(path);
    } else {
      yield path;
    }
  }
}

function truncate(match) {
  if (match.length <= 8) {
    return '…';
  }
  return `${match.slice(0, 4)}…${match.slice(-4)}`;
}

function record(filePath, patternName, offset, match) {
  findings.push({
    file: relative(REPO_ROOT, filePath),
    patternName,
    offset,
    preview: truncate(match),
  });
}

const PATTERNS = [
  ['Google API key', /AIza[0-9A-Za-z\-_]{35}/g],
  ['Google OAuth client secret', /GOCSPX-[A-Za-z0-9_-]+/g],
  // Matches the key:value pair regardless of quote style or spacing, so a minified or
  // differently-formatted service-account JSON still trips this (e.g. esbuild inlining a JSON
  // import as `{type:"service_account"}` rather than `{"type": "service_account"}`).
  ['service-account type marker', /['"]?type['"]?\s*:\s*['"]service_account['"]/g],
];

const LITERAL_MARKERS = [['service-account private-key marker', '-----BEGIN PRIVATE KEY-----']];

let filesScanned = 0;

for (const filePath of walk(BROWSER_DIST_DIR)) {
  filesScanned += 1;
  const contents = readFileSync(filePath, 'utf8');

  for (const [patternName, pattern] of PATTERNS) {
    for (const match of contents.matchAll(pattern)) {
      record(filePath, patternName, Buffer.byteLength(contents.slice(0, match.index)), match[0]);
    }
  }

  for (const [patternName, marker] of LITERAL_MARKERS) {
    let offset = contents.indexOf(marker);
    while (offset !== -1) {
      record(filePath, patternName, Buffer.byteLength(contents.slice(0, offset)), marker);
      offset = contents.indexOf(marker, offset + 1);
    }
  }
}

if (findings.length > 0) {
  console.error(`check:no-secrets found ${findings.length} problem(s):\n`);
  for (const finding of findings) {
    console.error(
      `  - ${finding.file}: ${finding.patternName} at byte offset ${finding.offset} (${finding.preview})`
    );
  }
  process.exit(1);
}

if (filesScanned === 0) {
  console.error(
    `check:no-secrets found 0 files under ${relative(REPO_ROOT, BROWSER_DIST_DIR)}; refusing to pass an empty scan`
  );
  process.exit(1);
}

console.log(
  `check:no-secrets: scanned ${filesScanned} file(s) in the browser bundle, no Google API keys, OAuth client secrets or service-account key markers found`
);
