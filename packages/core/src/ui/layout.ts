import type { ComponentDefinition } from '../types/component-registry.js';
import type { BoxProps } from '../jsx/intrinsics.js';
import type { BorderSpec, Dimension, StyleColor } from '../types/style.js';
import { h, defineComponent } from '../jsx/factory.js';
import { useState, useTheme } from '../runtime/hooks.js';

/**
 * Layout and containers.
 *
 * Every one of these is `box` with an opinion. That is the point: the layout
 * engine only ever sees the primitive, so a new container costs a function
 * rather than a new case in the engine.
 */

export interface RowProps extends BoxProps {
  /** Shorthand for `align`, which reads better on a row. */
  vAlign?: BoxProps['align'];
}

export const Row = defineComponent<RowProps>('Row', ({ vAlign, ...props }) =>
  h('box', { direction: 'row', align: vAlign ?? props.align ?? 'center', ...props }),
);

export const Column = defineComponent<BoxProps>('Column', (props) =>
  h('box', { direction: 'column', ...props }),
);

export interface CenterProps extends BoxProps {
  /** Centre horizontally, vertically, or both. */
  axis?: 'both' | 'horizontal' | 'vertical';
}

export const Center = defineComponent<CenterProps>('Center', ({ axis = 'both', ...props }) =>
  h('box', {
    flex: props.flex ?? 1,
    direction: 'column',
    justify: axis === 'horizontal' ? 'start' : 'center',
    align: axis === 'vertical' ? 'stretch' : 'center',
    ...props,
  }),
);

export interface GridProps extends BoxProps {
  columns: number;
  /** Space between columns. Falls back to `gap`. */
  columnGap?: number;
  rowGap?: number;
}

/**
 * A grid is rows of equal-flex cells. Terminals have no sub-cell measurement,
 * so an even split is the honest primitive; anything else is a Row with widths.
 */
export const Grid = defineComponent<GridProps>('Grid', ({ columns, columnGap, rowGap, children, ...props }) => {
  const items = Array.isArray(children) ? children : children === undefined ? [] : [children];
  const rows: unknown[][] = [];
  for (let i = 0; i < items.length; i += columns) rows.push(items.slice(i, i + columns));

  return h('box', { direction: 'column', gap: rowGap ?? props.gap ?? 0, ...props },
    ...rows.map((row, i) =>
      h('box', { key: i, direction: 'row', gap: columnGap ?? props.gap ?? 1 },
        ...row.map((cell, j) => h('box', { key: j, flex: 1 }, cell)),
        // Pad the last row so its cells keep the same width as the others.
        ...Array.from({ length: columns - row.length }, (_, k) =>
          h('box', { key: `pad${k}`, flex: 1 })),
      ),
    ),
  );
});

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

export interface DividerProps extends Omit<BoxProps, 'direction'> {
  /** A divider runs across the flow, so it names its own axis. */
  direction?: 'horizontal' | 'vertical';
  /** Text set into the rule. */
  label?: string;
  labelAlign?: 'left' | 'center' | 'right';
  char?: string;
}

export const Divider = defineComponent<DividerProps>('Divider', (props) => {
  const theme = useTheme();
  const { direction = 'horizontal', label, labelAlign = 'left', char, ...rest } = props;
  const chars = theme.borderChars();

  if (direction === 'vertical') {
    return h('box', { role: 'separator', width: 1, fill: char ?? chars.left, fg: 'border', ...rest });
  }

  if (!label) {
    return h('box', { role: 'separator', height: 1, fill: char ?? chars.top, fg: 'border', ...rest });
  }

  return h('box', { direction: 'row', gap: 1, height: 1, ...rest },
    labelAlign !== 'left' ? h('box', { flex: 1, fill: char ?? chars.top, fg: 'border' }) : null,
    h('text', { content: label, fg: 'muted' }),
    labelAlign !== 'right' ? h('box', { flex: 1, fill: char ?? chars.top, fg: 'border' }) : null,
  );
});

export interface SpacerProps extends BoxProps {
  size?: number;
}

export const Spacer = defineComponent<SpacerProps>('Spacer', ({ size, ...props }) =>
  h('spacer', { size, flex: size === undefined ? 1 : 0, ...props }),
);

export interface StackProps extends BoxProps {
  /** Space between children, from the theme's scale. */
  spacing?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

export const Stack = defineComponent<StackProps>('Stack', ({ spacing = 'sm', ...props }) => {
  const theme = useTheme();
  return h('box', { direction: 'column', gap: theme.spacing[spacing], ...props });
});

export interface ScrollViewProps extends BoxProps {
  /** Controlled offset. Omit to let the view manage its own. */
  offset?: number;
  onScroll?(offset: number): void;
  /** Draw a scrollbar track on the right when the content overflows. */
  scrollbar?: boolean;
}

/**
 * A scrolling viewport.
 *
 * Scroll position is a number of cells, not a fraction: a terminal cannot
 * scroll by half a line, and pretending otherwise makes a list jitter as it
 * rounds.
 */
export const ScrollView = defineComponent<ScrollViewProps>('ScrollView', (props) => {
  const { offset, onScroll, scrollbar = true, children, ...rest } = props;
  const [internal, setInternal] = useState(0);
  const top = offset ?? internal;

  const scrollTo = (next: number): void => {
    const clamped = Math.max(0, next);
    if (offset === undefined) setInternal(clamped);
    onScroll?.(clamped);
  };

  return h('box', {
    ...rest,
    overflow: 'scroll',
    scrollTop: top,
    direction: 'row',
    onKey: (event: { name: string }) => {
      if (event.name === 'up') { scrollTo(top - 1); return true; }
      if (event.name === 'down') { scrollTo(top + 1); return true; }
      if (event.name === 'pageup') { scrollTo(top - 10); return true; }
      if (event.name === 'pagedown') { scrollTo(top + 10); return true; }
      if (event.name === 'home') { scrollTo(0); return true; }
      return false;
    },
    onMouse: (event: { action: string; wheel?: number }) => {
      if (event.action !== 'wheel') return false;
      scrollTo(top + (event.wheel ?? 0) * 3);
      return true;
    },
  },
    h('box', { flex: 1, direction: 'column', scrollTop: top, overflow: 'scroll' }, children),
    scrollbar ? h(Scrollbar, { offset: top }) : null,
  );
});

const Scrollbar = defineComponent<{ offset: number }>('Scrollbar', () => {
  // The track is a border glyph, so it degrades with the rest of the chrome
  // rather than punching a stray box-drawing character through an ascii frame.
  const theme = useTheme();
  return h('box', { width: 1, fill: theme.borderChars().left, fg: 'borderSubtle' });
});

export interface SplitterProps extends BoxProps {
  direction?: 'row' | 'column';
  /** Size of the first pane, in cells or percent. */
  size?: Dimension;
  /** Cells the divider occupies. 0 hides it. */
  dividerSize?: number;
}

export const Splitter = defineComponent<SplitterProps>('Splitter', (props) => {
  const { direction = 'row', size = '50%', dividerSize = 1, children, ...rest } = props;
  const panes = Array.isArray(children) ? children : [children];

  return h('box', { direction, ...rest },
    h('box', { [direction === 'row' ? 'width' : 'height']: size }, panes[0]),
    dividerSize > 0
      ? h(Divider, { direction: direction === 'row' ? 'vertical' : 'horizontal' })
      : null,
    h('box', { flex: 1 }, panes[1]),
  );
});

export const LAYOUT_COMPONENTS: ComponentDefinition[] = [
  { component: 'Row', category: 'layout', renderer: { kind: 'function', render: Row }, description: 'Horizontal flex container.' },
  { component: 'Column', category: 'layout', renderer: { kind: 'function', render: Column }, description: 'Vertical flex container.' },
  { component: 'Center', category: 'layout', renderer: { kind: 'function', render: Center }, description: 'Centres its children.' },
  { component: 'Grid', category: 'layout', renderer: { kind: 'function', render: Grid }, description: 'Equal-width columns, wrapping into rows.' },
  { component: 'Panel', category: 'layout', renderer: { kind: 'function', render: Panel }, description: 'Titled region. Bordered or airy, following the theme.', variants: ['bordered', 'plain'], role: 'region' },
  { component: 'Divider', category: 'layout', renderer: { kind: 'function', render: Divider }, description: 'A rule, optionally labelled.', role: 'separator' },
  { component: 'Spacer', category: 'layout', renderer: { kind: 'function', render: Spacer }, description: 'Empty space, greedy by default.' },
  { component: 'Stack', category: 'layout', renderer: { kind: 'function', render: Stack }, description: 'Column with themed spacing.' },
  { component: 'ScrollView', category: 'layout', renderer: { kind: 'function', render: ScrollView }, description: 'Scrolling viewport with keyboard and wheel support.' },
  { component: 'Splitter', category: 'layout', renderer: { kind: 'function', render: Splitter }, description: 'Two panes with a divider.' },
];
