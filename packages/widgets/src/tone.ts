import type { SemanticVariant, StyleColor } from '@textui/core';

/**
 * The two halves of a tone.
 *
 * `TONE` is the colour a tone is drawn *in*; `ON_TONE` is what is written *on*
 * it once it becomes a background. They belong together and are stated once,
 * because a component that pairs `danger` with the wrong foreground produces
 * the one thing a status colour must never be, which is unreadable.
 *
 * The theme states an `on*` token per tone rather than a single "inverted" for
 * all of them: the contrast that works on a green fill is not the one that
 * works on a red one.
 */
export const TONE: Record<SemanticVariant, StyleColor> = {
  default: 'text',
  primary: 'primary',
  secondary: 'secondary',
  accent: 'accent',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  info: 'info',
  muted: 'muted',
};

// Adding a tone, or renaming an `on*` token, means three edits and only two of
// them are checked:
//
//   1. this map and its `TONE` pair;
//   2. every theme in themes/builtin.ts, or the token resolves to nothing;
//   3. the palette list in docs/themes/tokens.md - which `pnpm docs:check`
//      does NOT catch, because that check reads component prop interfaces and
//      knows nothing about token names.
//
// The third is the one that gets missed. `onDefault`, `onSecondary` and
// `onMuted` were absent from that page until they were added by hand.
export const ON_TONE: Record<SemanticVariant, StyleColor> = {
  default: 'onDefault',
  primary: 'onPrimary',
  secondary: 'onSecondary',
  accent: 'onAccent',
  success: 'onSuccess',
  warning: 'onWarning',
  danger: 'onDanger',
  info: 'onInfo',
  muted: 'onMuted',
};
