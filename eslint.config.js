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
  {
    // Nothing generated and nothing vendored. `_site` is what Jekyll builds and
    // `vendor` is the gems it builds with - both gitignored already, but eslint
    // does not read .gitignore, so it was reporting four hundred problems in
    // somebody else's minified javascript. Matched at any depth, like the rest
    // of this list, so a second docs site does not bring them all back.
    ignores: [
      '**/dist/**', '**/node_modules/**', '**/.dev/**', '**/coverage/**',
      '**/_site/**', '**/vendor/**', '**/.jekyll-cache/**',
      // Doc snippets, lifted out of the markdown by `docs:check`. Their unused
      // imports are the point - an example imports what it demonstrates - and
      // the `declare const app: import('...')` preamble is written for `tsc`,
      // which is the only tool that should have an opinion about them.
      'scripts/docs/snippets/src/**',
      // The sandbox. Everything in it but the manifest is gitignored, so
      // whatever is there is one person's throwaway and CI never sees it -
      // linting it means the repo's lint passes or fails on a file that is not
      // in the repo.
      'scratch/*.ts', 'scratch/*.tsx',
    ],
  },

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
    // The CLI, the playground runner and the repo's own scripts are console
    // programs. Printing is what they are for.
    files: [
      'packages/cli/**', 'playground/scripts/**', 'playground/src/main.tsx',
      'scripts/**',
    ],
    rules: { 'no-console': 'off' },
  },

  {
    files: ['**/test/**', '**/*.test.ts', '**/*.test.tsx'],
    rules: { 'no-console': 'off', '@typescript-eslint/no-non-null-assertion': 'off' },
  },
);
