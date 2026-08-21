import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: { include: ['test/**/*.test.ts', 'test/**/*.test.tsx'], environment: 'node' },
  esbuild: { jsx: 'automatic', jsxImportSource: '@textui/core' },
  resolve: {
    alias: {
      '@textui/core/jsx-runtime': resolve(__dirname, '../core/src/jsx/jsx-runtime.ts'),
      '@textui/core/jsx-dev-runtime': resolve(__dirname, '../core/src/jsx/jsx-dev-runtime.ts'),
      '@textui/core': resolve(__dirname, '../core/src/index.ts'),
      '@textui/terminal': resolve(__dirname, '../terminal/src/index.ts'),
      '@textui/documents': resolve(__dirname, '../documents/src/index.ts'),
      '@textui/testing': resolve(__dirname, '../testing/src/index.ts'),
    },
  },
});
