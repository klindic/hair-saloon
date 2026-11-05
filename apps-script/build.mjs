import { build } from 'esbuild';
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const distDir = join(root, 'dist');

mkdirSync(distDir, { recursive: true });

await build({
  entryPoints: [join(root, 'src', 'main.ts')],
  outfile: join(distDir, 'Code.js'),
  bundle: true,
  format: 'iife',
  globalName: '__entry',
  target: 'es2019',
  footer: {
    js: 'var doGet = __entry.doGet;\nvar doPost = __entry.doPost;',
  },
});

copyFileSync(join(root, 'src', 'appsscript.json'), join(distDir, 'appsscript.json'));

console.log('Built apps-script/dist/Code.js');
