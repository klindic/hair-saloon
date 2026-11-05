// Post-processes the Angular build output for GitHub Pages.
//
// Pages has no server-side router: it serves 404.html for any path that is not a real file, so a
// deep link like /book would otherwise get a bare 404. Copying index.html to 404.html makes Pages
// hand back the whole SPA for those paths, with the real URL intact, so the Angular router just
// routes it. No redirect, no sessionStorage hop, and nothing that hardcodes the site's own origin
// or base path — index.html already carries whatever --base-href the build used.
//
// .nojekyll stops Pages' Jekyll step from dropping files whose names start with an underscore.
import { copyFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BROWSER_DIST_DIR } from './dist-dir.mjs';

copyFileSync(join(BROWSER_DIST_DIR, 'index.html'), join(BROWSER_DIST_DIR, '404.html'));
writeFileSync(join(BROWSER_DIST_DIR, '.nojekyll'), '');

console.log(`pages: wrote 404.html and .nojekyll into ${BROWSER_DIST_DIR}`);
