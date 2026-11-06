// Proves the self-hosted font files named in T5 actually land in the built output, not just in
// node_modules. angular.json copies them there via an assets glob; this checks the copy happened
// so a renamed vendor package or a dropped assets entry fails the build instead of shipping a
// page with no Fraunces or Work Sans.
//
// Run: npm run check:fonts (also runs inside npm run verify)
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { BROWSER_DIST_DIR } from './dist-dir.mjs';

const expectedFiles = [
  'fonts/fraunces/fraunces-latin-standard-normal.woff2',
  'fonts/fraunces/fraunces-latin-ext-standard-normal.woff2',
  'fonts/work-sans/work-sans-latin-400-normal.woff2',
  'fonts/work-sans/work-sans-latin-ext-400-normal.woff2',
  'fonts/work-sans/work-sans-latin-500-normal.woff2',
  'fonts/work-sans/work-sans-latin-ext-500-normal.woff2',
  'fonts/work-sans/work-sans-latin-600-normal.woff2',
  'fonts/work-sans/work-sans-latin-ext-600-normal.woff2',
];

const missing = expectedFiles.filter((file) => !existsSync(join(BROWSER_DIST_DIR, file)));

if (missing.length > 0) {
  console.error(`check:fonts found ${missing.length} missing font file(s):\n`);
  for (const file of missing) {
    console.error(`  - ${file}`);
  }
  process.exit(1);
}

console.log(
  `check:fonts: all ${expectedFiles.length} self-hosted font files are present in the build`
);
