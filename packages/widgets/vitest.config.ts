import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: { include: ['test/**/*.test.ts', 'test/**/*.test.tsx'], environment: 'node' },
  // This package has JSX in it now - `pattern.tsx` and `font-text.tsx` - and
  // esbuild compiles it in a dev transform, which asks for `jsx-dev-runtime`.
  // The package's `exports` has no reason to point at that, so it is aliased,
  // the same way the chat package and the playground do it.
  esbuild: { jsx: 'automatic', jsxImportSource: '@textui/core' },
  resolve: {
    alias: {
      '@textui/core/jsx-runtime': resolve(__dirname, '../core/src/jsx/jsx-runtime.ts'),
      '@textui/core/jsx-dev-runtime': resolve(__dirname, '../core/src/jsx/jsx-dev-runtime.ts'),
      '@textui/core': resolve(__dirname, '../core/src/index.ts'),
    },
  },
});
