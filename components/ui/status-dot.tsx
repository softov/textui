import { defineComponent, useTheme, type BoxProps } from '@textui/core';

/**
 * The shared status vocabulary.
 *
 * Copied into your project on purpose: what counts as "degraded" is a product
 * decision, and the glyph and colour for it belong to you rather than to the
 * library. Keep the rule that a status is a glyph *and* a colour - a
 * 16-colour ssh session and a piped log both lose the colour.
 */
export type Status = 'up' | 'degraded' | 'down' | 'pending' | 'unknown';

export interface StatusDotProps extends BoxProps {
  status: Status;
  label?: string;
  /** Show the status word after the dot. */
  showLabel?: boolean;
}

export function StatusDot({ status, label, showLabel, ...rest }: StatusDotProps) {
  const theme = useTheme();

  const map = {
    up: { glyph: theme.glyphs.bulletFilled, fg: 'success' as const, word: 'up' },
    degraded: { glyph: theme.glyphs.bulletHalf, fg: 'warning' as const, word: 'degraded' },
    down: { glyph: theme.glyphs.bulletHollow, fg: 'danger' as const, word: 'down' },
    pending: { glyph: theme.glyphs.bulletHollow, fg: 'info' as const, word: 'pending' },
    unknown: { glyph: theme.glyphs.separator, fg: 'muted' as const, word: 'unknown' },
  }[status];

  return (
    <box role="status" label={label ?? map.word} direction="row" gap={1} {...rest}>
      <text content={map.glyph} fg={map.fg} />
      {label ? <text content={label} /> : null}
      {showLabel ? <text content={map.word} fg="muted" /> : null}
    </box>
  );
}

export default defineComponent('StatusDot', StatusDot);
