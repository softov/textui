import type { SemanticVariant, StyleColor } from '../types/style.js';

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

export const ON_TONE: Record<SemanticVariant, StyleColor> = {
  default: 'inverted',
  primary: 'onPrimary',
  secondary: 'inverted',
  accent: 'onAccent',
  success: 'onSuccess',
  warning: 'onWarning',
  danger: 'onDanger',
  info: 'onInfo',
  muted: 'inverted',
};
