import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// root is pinned to this directory so the suite runs the same whether it is started from the
// repo root (npm run test:script) or from inside apps-script/.
export default defineConfig({
  root: import.meta.dirname,
  resolve: {
    // tsc and esbuild both read the @contract/* mapping straight out of apps-script/tsconfig.json;
    // Vite does not read tsconfig paths, so the one alias the backend uses is repeated here.
    alias: {
      '@contract': fileURLToPath(new URL('../shared', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['**/*.spec.ts'],
  },
});
