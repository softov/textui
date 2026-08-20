import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: { include: ['test/**/*.test.ts'], environment: 'node' },
  resolve: {
    alias: { '@textui/core': resolve(__dirname, '../core/src/index.ts') },
  },
});
