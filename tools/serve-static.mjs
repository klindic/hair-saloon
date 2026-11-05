// Serves the built bundle the way GitHub Pages serves it, for `npm run preview` and for the
// Playwright run. Deliberately behaves like Pages rather than like a dev server: any path that is
// not a real file gets 404.html back with a 404 status, which is how a deep link reaches the
// Angular router in production.
//
// Usage: node tools/serve-static.mjs [--port 4310] [--base /hair-saloon/]
// No dependency is added for this; the manifest stays small.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { BROWSER_DIST_DIR } from './dist-dir.mjs';

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

const PORT = Number(arg('port', 4310));
const BASE = arg('base', '/').replace(/\/*$/, '/');

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.md': 'text/markdown; charset=utf-8',
};

async function resolveFile(urlPath) {
  const safePath = normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, '');
  const filePath = join(BROWSER_DIST_DIR, safePath);
  if (!filePath.startsWith(BROWSER_DIST_DIR)) {
    return null;
  }
  try {
    const stats = await stat(filePath);
    return stats.isFile() ? filePath : null;
  } catch {
    return null;
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Anything outside the base path does not exist on Pages either.
  if (BASE !== '/' && !url.pathname.startsWith(BASE)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`not found outside base path ${BASE}`);
    return;
  }

  const withinBase = `/${url.pathname.slice(BASE.length)}`;
  const requestedPath = decodeURIComponent(withinBase === '/' ? '/index.html' : withinBase);

  const matchedFile = await resolveFile(requestedPath);
  const filePath = matchedFile ?? (await resolveFile('/404.html'));
  const status = matchedFile ? 200 : 404;

  if (!filePath) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('dist bundle is missing index.html and 404.html — run npm run build first');
    return;
  }

  const body = await readFile(filePath);
  const contentType = CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream';
  res.writeHead(status, { 'Content-Type': contentType });
  res.end(body);
});

server.listen(PORT, () => {
  console.log(`serving ${BROWSER_DIST_DIR} at http://localhost:${PORT}${BASE}`);
});
