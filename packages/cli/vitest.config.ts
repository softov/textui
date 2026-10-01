import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: { include: ['test/**/*.test.ts'], environment: 'node' },
  // The aliases point at sources, and a source with JSX in it imports the
  // runtime - which the plain `@textui/core` alias would otherwise swallow as a
  // prefix, leaving a path that does not exist. The jsx entries come first so
  // they win.
  esbuild: { jsx: 'automatic', jsxImportSource: '@textui/core' },
  resolve: {
    alias: {
      '@textui/core/jsx-runtime': resolve(__dirname, '../core/src/jsx/jsx-runtime.ts'),
      '@textui/core/jsx-dev-runtime': resolve(__dirname, '../core/src/jsx/jsx-dev-runtime.ts'),
      '@textui/core': resolve(__dirname, '../core/src/index.ts'),
      '@textui/widgets': resolve(__dirname, '../widgets/src/index.ts'),
      '@textui/terminal': resolve(__dirname, '../terminal/src/index.ts'),
    },
  },
});
