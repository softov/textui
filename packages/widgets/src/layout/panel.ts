import type { BorderSpec, BoxProps, StyleColor } from '@textui/core';
import { defineComponent, h, resolveEdges, useTheme } from '@textui/core';

export interface PanelProps extends BoxProps {
  /** Section heading drawn into the border, or above a borderless panel. */
  title?: string;
  subtitle?: string;
  /** Accent colour for the title. */
  tone?: StyleColor;
  /** Overrides the theme's default border. `'none'` gives an airy panel. */
  border?: BorderSpec;
  /**
   * Right-aligned text beside the title, on the same row.
   *
   * The short thing that belongs next to a heading rather than under it: a
   * count, a state, the shortcut that opens it. Optional, and most panels do
   * not have one.
   */
  rightTitle?: string;
  /**
   * Right-aligned text on the *bottom* rule, where there is one.
   *
   * Not the title row - which is what this said for a long time while doing
   * something else. A bordered panel put it in the footer and a borderless one
   * put it beside the title, so the same prop meant two places depending on a
   * different prop. `rightTitle` is the title row, in both; this is the
   * bottom, and on a borderless panel there is no bottom to put it on.
   */
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
  const { title, subtitle, tone, meta, rightTitle, children, padding, ...rest } = props;

  /*
   * Padding is about the *body*, and a subtitle is not the body.
   *
   * It used to be one box: the border or the heading row, then the subtitle
   * and the children together inside whatever padding the caller asked for. So
   * `padding={1}` put a blank row between the title and its own caption and
   * left the caption sitting directly on top of the content it was not part
   * of - the subtitle read as the first line of the body. On a borderless
   * panel it pushed the title down as well.
   *
   * Split, then: the horizontal padding stays outside and applies to
   * everything, because a subtitle indented differently from the body under it
   * is worse than either; the vertical padding wraps the children alone.
   *
   * Only when there is a subtitle to protect. Without one there is nothing to
   * separate the padding from, and a panel that gained a box would be a panel
   * whose layout changed for no reason.
   */
  const pad = resolveEdges(padding);
  const split = subtitle !== undefined && (pad.top > 0 || pad.bottom > 0);
  const outerPad = split ? { left: pad.left, right: pad.right } : padding;
  const body = split
    ? h('box', { direction: 'column', padding: { top: pad.top, bottom: pad.bottom } }, children)
    : children;
  const border = props.border ?? theme.border;
  const borderless = border === 'none' || (typeof border === 'object' && border.style === 'none');

  // A panel is a pane, so it fills its row rather than floating in the middle
  // of it. `Row` centres its children by default, which is right for a row of
  // labels and wrong for a row of panels sitting next to a taller one.
  const fill = { alignSelf: 'stretch' as const };

  if (!borderless) {
    // Two rules, two labels: `rightTitle` on the top one beside the title, and
    // `meta` on the bottom one. The border painter gives the right label its
    // width first, so a long title truncates rather than running into it.
    return h('box', {
      role: 'region',
      border,
      title,
      ...(rightTitle !== undefined ? { rightTitle } : {}),
      footer: meta,
      footerAlign: 'right',
      ...fill,
      ...(outerPad === undefined ? {} : { padding: outerPad }),
      ...rest,
    },
      subtitle !== undefined ? h('text', { content: subtitle, fg: 'muted' }) : null,
      body,
    );
  }

  return h('box', {
    role: 'region',
    direction: 'column',
    ...fill,
    ...(outerPad === undefined ? {} : { padding: outerPad }),
    ...rest,
    border: 'none',
  },
    title
      ? h('box', { direction: 'row', gap: 1 },
          h('text', { content: title, bold: true, fg: tone ?? 'text', flex: 1, truncate: 'end' }),
          // No border to write on, so the same two labels share the heading
          // row - `rightTitle` first, because it is the one that must survive.
          rightTitle ? h('text', { content: rightTitle, fg: 'muted' }) : null,
          meta ? h('text', { content: meta, fg: 'muted' }) : null)
      : null,
    subtitle !== undefined ? h('text', { content: subtitle, fg: 'muted' }) : null,
    body,
  );
});
