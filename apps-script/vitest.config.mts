import { defineConfig } from 'vitest/config';

// root is pinned to this directory so the suite runs the same whether it is started from the
// repo root (npm run test:script) or from inside apps-script/.
export default defineConfig({
  root: import.meta.dirname,
  test: {
    environment: 'node',
    include: ['**/*.spec.ts'],
  },
});
