// Proves the thing that actually ships. `npm run build` is served from the domain root, but
// GitHub Pages serves this repository from a project path (/hair-saloon/), and the two can differ
// in exactly the ways that are invisible until the live link is broken: a wrong <base href>, a
// missing 404.html fallback, assets that resolve above the base path.
//
// So: build with the Pages base href, serve it the way Pages serves it, and assert over HTTP.
// Browser-level behaviour (the router actually booting) is covered by the Playwright suite
// against the root build; this covers the deploy path.
//
// Run: npm run check:pages (also runs inside npm run verify)
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { BROWSER_DIST_DIR, REPO_ROOT } from './dist-dir.mjs';

// Read the base href out of the build:pages script so this check cannot drift from the deploy.
const packageJson = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'));
const baseHrefMatch = /--base-href\s+(\S+)/.exec(packageJson.scripts['build:pages']);
if (!baseHrefMatch) {
  console.error('check:pages: no --base-href found in the build:pages script');
  process.exit(1);
}
const base = baseHrefMatch[1].replace(/\/*$/, '/');
const port = 4311;
const failures = [];

const indexHtml = readFileSync(join(BROWSER_DIST_DIR, 'index.html'), 'utf8');
if (!indexHtml.includes(`<base href="${base}">`)) {
  failures.push(
    `index.html does not carry <base href="${base}">. Did the build run through build:pages?`
  );
}

const server = spawn(
  process.execPath,
  [join(REPO_ROOT, 'tools', 'serve-static.mjs'), '--base', base, '--port', String(port)],
  { stdio: 'ignore' }
);

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      await fetch(`http://localhost:${port}${base}`);
      return true;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  return false;
}

// [path, expected status, what it proves]
const expectations = [
  [base, 200, 'the site root under the base path'],
  [`${base}book`, 404, 'a deep link gets the SPA back via the 404.html fallback'],
  [`${base}assets/config.json`, 200, 'runtime config resolves under the base path'],
  [`${base}assets/fixtures/busy.json`, 200, 'demo fixtures resolve under the base path'],
  ['/', 404, 'nothing is served above the base path'],
];

try {
  if (!(await waitForServer())) {
    failures.push('the static server never came up');
  } else {
    for (const [path, expectedStatus, what] of expectations) {
      const response = await fetch(`http://localhost:${port}${path}`);
      if (response.status !== expectedStatus) {
        failures.push(`${path} returned ${response.status}, expected ${expectedStatus} — ${what}`);
      }
    }

    const fallback = await fetch(`http://localhost:${port}${base}book`);
    const body = await fallback.text();
    if (!body.includes('<app-root>')) {
      failures.push(`${base}book did not return the application shell; the SPA fallback is broken`);
    }
  }
} finally {
  server.kill();
}

if (failures.length > 0) {
  console.error(`check:pages found ${failures.length} problem(s):\n`);
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

console.log(`check:pages: base href, deep-link fallback and asset paths all correct under ${base}`);
