import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

/**
 * Lint rules.
 *
 * Narrow on purpose: the type checker already runs over every workspace, so
 * this covers what types cannot - unused code, accidental `any`, and the
 * control characters that would corrupt a frame if one slipped into a string.
 */
export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/.dev/**', '**/coverage/**'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      'no-console': ['warn', { allow: ['error', 'warn'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
      'object-shorthand': 'error',
    },
  },

  {
    // The CLI and the playground runner are console programs.
    files: ['packages/cli/**', 'playground/scripts/**', 'playground/src/main.tsx'],
    rules: { 'no-console': 'off' },
  },

  {
    files: ['**/test/**', '**/*.test.ts', '**/*.test.tsx'],
    rules: { 'no-console': 'off', '@typescript-eslint/no-non-null-assertion': 'off' },
  },
);
