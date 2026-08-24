import type { ResolvedTheme } from '@textui/core';

/**
 * Raise a toast.
 *
 * Exists because the alternative - every caller assembling a layer entry - is
 * how two of them end up with different timeouts and one of them forgets the
 * `notification` layer and lands under the dialog it is reporting on.
 */
/**
 * The footer of an overlay: what the keys do.
 *
 * Joined with the theme's separator rather than a `·` written here, because a
 * terminal that cannot draw a middle dot draws a `?` instead - and the row it
 * ruins is the one telling you how to get out.
 */
export function hint(theme: ResolvedTheme, parts: string[]): string {
  return parts.join(` ${theme.glyphs.separator} `);
}
