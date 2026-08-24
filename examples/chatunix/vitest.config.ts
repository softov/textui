import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: { include: ['test/**/*.test.ts'], environment: 'node' },
  resolve: {
    alias: {
      '@textui/core': resolve(__dirname, '../../packages/core/src/index.ts'),
      '@textui/widgets': resolve(__dirname, '../../packages/widgets/src/index.ts'),
      '@textui/terminal': resolve(__dirname, '../../packages/terminal/src/index.ts'),
      textui: resolve(__dirname, '../../packages/facade/src/index.ts'),
    },
  },
});
