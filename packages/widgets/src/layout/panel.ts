import type { BorderSpec, BoxProps, StyleColor } from '@textui/core';
import { defineComponent, h, useTheme } from '@textui/core';

export interface PanelProps extends BoxProps {
  /** Section heading drawn into the border, or above a borderless panel. */
  title?: string;
  subtitle?: string;
  /** Accent colour for the title. */
  tone?: StyleColor;
  /** Overrides the theme's default border. `'none'` gives an airy panel. */
  border?: BorderSpec;
  /** Right-aligned text in the title row. Counts, hints, shortcuts. */
  meta?: string;
}

/**
 * The workhorse container.
 *
 * A panel is the one component that has to look right in all three house
 * styles, so it renders its title into the border when it has one and as a
 * heading row when it does not - rather than forcing a border to have a title.
 */
export const Panel = defineComponent<PanelProps>('Panel', (props) => {
  const theme = useTheme();
  const { title, subtitle, tone, meta, children, ...rest } = props;
  const border = props.border ?? theme.border;
  const borderless = border === 'none' || (typeof border === 'object' && border.style === 'none');

  // A panel is a pane, so it fills its row rather than floating in the middle
  // of it. `Row` centres its children by default, which is right for a row of
  // labels and wrong for a row of panels sitting next to a taller one.
  const fill = { alignSelf: 'stretch' as const };

  if (!borderless) {
    // `meta` goes into the bottom rule when there is one. The alternative was
    // a prop that silently did nothing on any panel with a border, which is
    // most of them.
    return h('box', {
      role: 'region',
      border,
      title,
      footer: meta,
      footerAlign: 'right',
      ...fill,
      ...rest,
    },
      subtitle ? h('text', { content: subtitle, fg: 'muted' }) : null,
      children,
    );
  }

  return h('box', { role: 'region', direction: 'column', ...fill, ...rest, border: 'none' },
    title
      ? h('box', { direction: 'row', gap: 1 },
          h('text', { content: title, bold: true, fg: tone ?? 'text' }),
          meta ? h('spacer', { flex: 1 }) : null,
          meta ? h('text', { content: meta, fg: 'muted' }) : null)
      : null,
    subtitle ? h('text', { content: subtitle, fg: 'muted' }) : null,
    children,
  );
});
