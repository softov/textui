/**
 * So `jsxImportSource: "textui"` works.
 *
 * Without this a JSX file has to point its transform at `@textui/core`, which
 * means installing a second package to compile a file that imports one - and
 * under a strict node_modules layout it is not even resolvable.
 */
export * from '@textui/core/jsx-runtime';
