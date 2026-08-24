import type {
  ComponentDefinition,
  BoxProps,
  TextProps,
  SemanticVariant,
  StyleColor,
  SurfaceVariant,
} from '@textui/core';
import {
  h,
  defineComponent,
  useEffect,
  useFrame,
  useMeasure,
  useRef,
  useRuntime,
  useState,
  useTheme,
  useTicker,
  stringWidth,
} from '@textui/core';
import { ON_TONE, TONE as TONE_COLOR } from './tone.js';

/**
 * Display components.
 *
 * The rule that shapes all of them: **meaning never depends on colour alone.**
 * A degraded service is a different glyph as well as a different colour,
 * because a 16-colour ssh session, a colourblind reader and a piped log all
 * lose the colour and keep the glyph.
 */


export interface HeadingProps extends TextProps {
  level?: 1 | 2 | 3;
}

export const Heading = defineComponent<HeadingProps>('Heading', ({ level = 1, ...props }) =>
  h('text', {
    role: 'heading',
    bold: level <= 2,
    dim: level === 3,
    fg: level === 1 ? 'text' : level === 2 ? 'text' : 'muted',
    ...props,
  }),
);

export interface LabelProps extends TextProps {
  tone?: SemanticVariant;
}

export const Label = defineComponent<LabelProps>('Label', ({ tone = 'muted', ...props }) =>
  h('text', { role: 'label', fg: TONE_COLOR[tone], ...props }),
);

export interface BadgeProps extends BoxProps {
  label: string;
  tone?: SemanticVariant;
  variant?: SurfaceVariant;
  /** Glyph before the label, so the badge reads without colour. */
  icon?: string;
}

export const Badge = defineComponent<BadgeProps>('Badge', (props) => {
  const { label, tone = 'default', variant = 'ghost', icon, ...rest } = props;
  const color = TONE_COLOR[tone];

  // `ghost` is chrome-less: the tone, and nothing around it. That is the
  // default because it is the badge that fits in a sentence, and it is what
  // `ghost` already means on Button - one word, one meaning, both components.
  const style =
    variant === 'solid' ? { bg: color, fg: ON_TONE[tone] } : { fg: color };

  // A badge is inline: it sits in a row of text and must stay one line tall.
  // The outline variant is therefore brackets rather than a box border - a
  // three-row chip in a sentence is not an outline, it is a panel.
  const brackets = variant === 'outline';

  return h('box', {
    direction: 'row',
    gap: icon ? 1 : 0,
    padding: variant === 'solid' ? [0, 1] : 0,
    ...style,
    ...rest,
  },
    brackets ? h('text', { content: '[' }) : null,
    icon ? h('text', { content: icon }) : null,
    h('text', { content: label }),
    brackets ? h('text', { content: ']' }) : null,
  );
});

export interface StatusDotProps extends BoxProps {
  status: 'up' | 'down' | 'degraded' | 'unknown' | 'pending';
  label?: string;
}

/** The status vocabulary, so "degraded" looks the same everywhere. */
export const StatusDot = defineComponent<StatusDotProps>('StatusDot', ({ status, label, ...rest }) => {
  const theme = useTheme();
  const map = {
    up: { glyph: theme.glyphs.bulletFilled, fg: 'success' as StyleColor },
    degraded: { glyph: theme.glyphs.bulletHalf, fg: 'warning' as StyleColor },
    down: { glyph: theme.glyphs.bulletHollow, fg: 'danger' as StyleColor },
    pending: { glyph: theme.glyphs.bulletHollow, fg: 'info' as StyleColor },
    unknown: { glyph: theme.glyphs.separator, fg: 'muted' as StyleColor },
  }[status];

  return h('box', { role: 'status', label: label ?? status, direction: 'row', gap: 1, ...rest },
    h('text', { content: map.glyph, fg: map.fg }),
    label ? h('text', { content: label }) : null,
  );
});

export interface AlertProps extends BoxProps {
  tone?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
  message?: string;
}

export const Alert = defineComponent<AlertProps>('Alert', (props) => {
  const theme = useTheme();
  const { tone = 'info', title, message, children, ...rest } = props;
  const icon = {
    info: theme.glyphs.info,
    success: theme.glyphs.check,
    warning: theme.glyphs.warning,
    danger: theme.glyphs.cross,
  }[tone];

  return h('box', { role: 'alert', direction: 'row', gap: 1, ...rest },
    h('text', { content: icon, fg: tone }),
    h('box', { direction: 'column', flex: 1 },
      title ? h('text', { content: title, bold: true, fg: tone }) : null,
      message ? h('text', { content: message, wrap: 'word' }) : null,
      children,
    ),
  );
});

export interface CardProps extends BoxProps {
  title?: string;
  subtitle?: string;
  footer?: string;
}

export const Card = defineComponent<CardProps>('Card', (props) => {
  const theme = useTheme();
  const { title, subtitle, children, ...rest } = props;
  return h('box', {
    border: theme.border,
    padding: theme.density === 'compact' ? 0 : [0, 1],
    direction: 'column',
    title,
    ...rest,
  },
    subtitle ? h('text', { content: subtitle, fg: 'muted' }) : null,
    children,
  );
});

export interface KeyValueProps extends BoxProps {
  items: { label: string; value: string; tone?: SemanticVariant }[];
  /** Cells reserved for labels. Computed from the longest when unset. */
  labelWidth?: number;
  columns?: number;
}

/** Structured data as aligned label/value pairs. */
export const KeyValue = defineComponent<KeyValueProps>('KeyValue', (props) => {
  const { items, labelWidth, columns = 1, ...rest } = props;
  const width = labelWidth ?? Math.max(0, ...items.map((i) => stringWidth(i.label)));

  const rows: typeof items[] = [];
  for (let i = 0; i < items.length; i += columns) rows.push(items.slice(i, i + columns));

  return h('box', { direction: 'column', ...rest },
    ...rows.map((row, i) =>
      h('box', { key: i, direction: 'row', gap: 2 },
        ...row.map((item, j) =>
          h('box', { key: j, direction: 'row', gap: 1, flex: 1 },
            h('box', { width }, h('text', { content: item.label, fg: 'muted' })),
            h('text', { content: item.value, fg: item.tone ? TONE_COLOR[item.tone] : undefined, truncate: 'end', flex: 1 }),
          ),
        ),
      ),
    ),
  );
});

export interface ProgressProps extends BoxProps {
  /** 0..1. Omit for an indeterminate bar. */
  value?: number;
  total?: number;
  label?: string;
  /** Show the percentage after the bar. */
  showValue?: boolean;
  tone?: SemanticVariant;
  barWidth?: number;
  /**
   * A fixed gutter for the label, so a stack of bars starts at one column.
   *
   * Labels are their own width otherwise, which is right for one bar and
   * wrong for three: "download", "index" and "working" each push their track
   * to a different place and the group reads as three unrelated widgets.
   * Nothing here can measure its siblings, so whoever stacks them says.
   */
  labelWidth?: number;
}

/**
 * A progress bar with sub-cell resolution: the partial block glyphs give eight
 * steps per cell, so a 20-cell bar moves smoothly rather than in 5% jumps.
 */
export const Progress = defineComponent<ProgressProps>('Progress', (props) => {
  const theme = useTheme();
  const {
    value, total = 1, label, showValue = true, tone = 'primary', barWidth, labelWidth, ...rest
  } = props;
  const frame = useFrame(8);

  const width = barWidth ?? 20;
  const ratio = value === undefined ? 0 : Math.max(0, Math.min(1, value / total));

  let bar: string;
  if (value === undefined) {
    // Indeterminate: a block that travels the track.
    const pos = frame % Math.max(1, width);
    bar = Array.from({ length: width }, (_, i) =>
      Math.abs(i - pos) < 2 ? theme.glyphs.progressFull : theme.glyphs.progressEmpty,
    ).join('');
  } else {
    const exact = ratio * width;
    const full = Math.floor(exact);
    const partials = theme.glyphs.progressPartial;
    const remainder = exact - full;
    const partialIndex = Math.floor(remainder * partials.length);
    const partial = full < width && remainder > 0 ? (partials[partialIndex] ?? '') : '';
    bar =
      theme.glyphs.progressFull.repeat(full) +
      partial +
      theme.glyphs.progressEmpty.repeat(Math.max(0, width - full - (partial ? 1 : 0)));
  }

  return h('box', { role: 'progressbar', label, direction: 'row', gap: 1, ...rest },
    label
      ? h('text', {
          content: label,
          fg: 'muted',
          ...(labelWidth === undefined ? {} : { width: labelWidth, truncate: 'end' as const }),
        })
      : null,
    h('text', { content: bar, fg: TONE_COLOR[tone] }),
    showValue && value !== undefined
      ? h('text', { content: `${Math.round(ratio * 100)}%`, fg: 'muted' })
      : null,
  );
});

export interface SpinnerProps extends BoxProps {
  label?: string;
  tone?: SemanticVariant;
}

export const Spinner = defineComponent<SpinnerProps>('Spinner', ({ label, tone = 'accent', ...rest }) => {
  const theme = useTheme();
  const frame = useFrame(10);
  const frames = theme.glyphs.spinner;
  const glyph = frames[frame % frames.length] ?? frames[0] ?? '*';

  return h('box', { role: 'status', direction: 'row', gap: 1, ...rest },
    h('text', { content: glyph, fg: TONE_COLOR[tone] }),
    label ? h('text', { content: label }) : null,
  );
});

export interface MarqueeProps extends TextProps {
  content: string;
  /**
   * Slide, or rest.
   *
   * Off is the resting state and the common one: a list of twenty rows is
   * twenty still labels, and the one under the cursor is the one that moves.
   * It is also what keeps the cost honest - a marquee that is not sliding
   * holds no ticker at all, so a menu is one animation and not one per row.
   */
  active?: boolean;
  /** Cells a second. */
  speed?: number;
  /** How long it waits at each end, in milliseconds. */
  dwell?: number;
  fps?: number;
}

/**
 * Text too long for its box, read by sliding it.
 *
 * The alternative was making something else give up room, and in a list there
 * is nothing else to take it from: a row is a label and a description and both
 * of them are the answer to "what is this". Truncating is fine for the rows you
 * are scanning past and useless for the one you have stopped on - which is
 * exactly the row a marquee costs anything for.
 *
 * Rests at the start, slides to the end, waits, and comes back. Not a loop
 * that wraps around: text that reappears from the right while its own tail is
 * still leaving reads as two strings rather than one long one.
 *
 * Nothing moves where animation is off - a pipe, a CI log, a reader who asked
 * for stillness - and there it is an ordinary truncated label.
 */
export const Marquee = defineComponent<MarqueeProps>('Marquee', (props) => {
  const { content, active = false, speed = 8, dwell = 900, fps = 10, ...rest } = props;
  const runtime = useRuntime();
  // What the last layout gave this text. Zero on the first pass, which is the
  // one where nothing is known and the honest answer is the whole string.
  const width = useMeasure().width;
  const travel = width > 0 ? Math.max(0, stringWidth(content) - width) : 0;
  const sliding = active && travel > 0 && !runtime.animation.disabled;

  // The ticker's own frame number, not a count of callbacks. A clock driven
  // by hand - a test, a static render - advances several frames in one call,
  // and a counter that adds one per call runs at whatever rate it was driven
  // at rather than at the rate it asked for.
  const [frame, setFrame] = useState(0);
  const seen = useRef(0);
  const from = useRef(0);
  useTicker((at) => { seen.current = at; setFrame(at - from.current); }, { fps, enabled: sliding });
  // Back to the start whenever it stops or the words change, so the row you
  // leave is the row you saw when you arrived at it.
  useEffect(() => { from.current = seen.current; setFrame(0); }, [sliding, content]);

  if (!sliding) return h('text', { content, truncate: 'end', ...rest });

  const perCell = Math.max(1, Math.round(fps / speed));
  const hold = Math.max(1, Math.round((dwell / 1000) * fps));
  const slide = travel * perCell;
  const cycle = hold + slide + hold + slide;
  const at = frame % cycle;
  const offset = at < hold
    ? 0
    : at < hold + slide
      ? Math.floor((at - hold) / perCell)
      : at < hold + slide + hold
        ? travel
        : travel - Math.floor((at - hold - slide - hold) / perCell);

  // Pinned to what it measured. Without this the sliced string is narrower
  // than the whole one, the layout hands the box back a different width, and
  // the next frame measures something new - a row that shivers.
  return h('text', { content: content.slice(offset, offset + width), width, ...rest });
});

export interface SkeletonProps extends BoxProps {
  lines?: number;
  /** Width of each line, in cells or as a fraction of the box. */
  widths?: number[];
}

export const Skeleton = defineComponent<SkeletonProps>('Skeleton', ({ lines = 3, widths, ...rest }) =>
  h('box', { direction: 'column', gap: 0, ...rest },
    ...Array.from({ length: lines }, (_, i) =>
      h('box', {
        key: i,
        height: 1,
        width: widths?.[i] ?? (i === lines - 1 ? '60%' : '100%'),
        fill: '░',
        fg: 'borderSubtle',
      }),
    ),
  ),
);

export interface EmptyStateProps extends BoxProps {
  title: string;
  message?: string;
  icon?: string;
  /** Hint text: what the reader can do about it. */
  hint?: string;
}

export const EmptyState = defineComponent<EmptyStateProps>('EmptyState', (props) => {
  const { title, message, icon, hint, children, ...rest } = props;
  return h('box', { direction: 'column', align: 'center', justify: 'center', flex: 1, gap: 0, ...rest },
    icon ? h('text', { content: icon, fg: 'subtle' }) : null,
    h('text', { content: title, bold: true, fg: 'muted' }),
    message ? h('text', { content: message, fg: 'subtle', wrap: 'word', textAlign: 'center' }) : null,
    hint ? h('text', { content: hint, fg: 'subtle', dim: true }) : null,
    children,
  );
});

export interface ErrorStateProps extends BoxProps {
  title?: string;
  error: unknown;
  /** Command id offered as a retry. */
  onRetry?: () => void;
}

export const ErrorState = defineComponent<ErrorStateProps>('ErrorState', (props) => {
  const theme = useTheme();
  const { title = 'Something went wrong', error, onRetry, ...rest } = props;
  const message = error instanceof Error ? error.message : String(error);

  return h('box', { role: 'alert', direction: 'column', gap: 1, padding: 1, ...rest },
    h('box', { direction: 'row', gap: 1 },
      h('text', { content: theme.glyphs.cross, fg: 'danger' }),
      h('text', { content: title, bold: true, fg: 'danger' })),
    h('text', { content: message, fg: 'muted', wrap: 'word' }),
    onRetry ? h('text', { content: 'r  retry', fg: 'subtle' }) : null,
  );
});

export interface TimelineProps extends BoxProps {
  items: {
    time?: string;
    title: string;
    description?: string;
    tone?: SemanticVariant;
    icon?: string;
  }[];
}

export const Timeline = defineComponent<TimelineProps>('Timeline', ({ items, ...rest }) => {
  const theme = useTheme();
  return h('box', { direction: 'column', ...rest },
    ...items.map((item, i) =>
      h('box', { key: i, direction: 'row', gap: 1 },
        h('box', { direction: 'column', width: 1 },
          h('text', { content: item.icon ?? theme.glyphs.bulletFilled, fg: item.tone ? TONE_COLOR[item.tone] : 'accent' }),
          i < items.length - 1 ? h('text', { content: theme.borderChars().left, fg: 'borderSubtle' }) : null),
        h('box', { direction: 'column', flex: 1 },
          h('box', { direction: 'row', gap: 1 },
            h('text', { content: item.title, bold: true }),
            item.time ? h('spacer', { flex: 1 }) : null,
            item.time ? h('text', { content: item.time, fg: 'muted' }) : null),
          item.description ? h('text', { content: item.description, fg: 'muted', wrap: 'word' }) : null),
      ),
    ),
  );
});

export const DISPLAY_COMPONENTS: ComponentDefinition[] = [
  { component: 'Heading', category: 'display', renderer: { kind: 'function', render: Heading }, role: 'heading', description: 'Section heading, three levels.' },
  { component: 'Label', category: 'display', renderer: { kind: 'function', render: Label }, role: 'label', description: 'Secondary text with a semantic tone.' },
  { component: 'Badge', category: 'display', renderer: { kind: 'function', render: Badge }, variants: ['solid', 'outline', 'ghost'], description: 'Small status marker; carries a glyph as well as a colour.' },
  { component: 'StatusDot', category: 'display', renderer: { kind: 'function', render: StatusDot }, role: 'status', description: 'The shared status vocabulary: up, degraded, down.' },
  { component: 'Alert', category: 'feedback', renderer: { kind: 'function', render: Alert }, role: 'alert', description: 'A message with an icon and a tone.' },
  { component: 'Card', category: 'display', renderer: { kind: 'function', render: Card }, description: 'Bordered block with a title.' },
  { component: 'KeyValue', category: 'data', renderer: { kind: 'function', render: KeyValue }, description: 'Aligned label/value pairs.' },
  { component: 'Progress', category: 'feedback', renderer: { kind: 'function', render: Progress }, role: 'progressbar', description: 'Determinate or indeterminate bar, sub-cell resolution.' },
  { component: 'Spinner', category: 'feedback', renderer: { kind: 'function', render: Spinner }, role: 'status', description: 'Animated activity indicator.' },
  { component: 'Marquee', category: 'display', renderer: { kind: 'function', render: Marquee }, role: 'marquee', description: 'Text too long for its box, read by sliding it while it has the cursor.' },
  { component: 'Skeleton', category: 'feedback', renderer: { kind: 'function', render: Skeleton }, description: 'Loading placeholder.' },
  { component: 'EmptyState', category: 'feedback', renderer: { kind: 'function', render: EmptyState }, description: 'Nothing here, and what to do about it.' },
  { component: 'ErrorState', category: 'feedback', renderer: { kind: 'function', render: ErrorState }, role: 'alert', description: 'A failure, with its message.' },
  { component: 'Timeline', category: 'data', renderer: { kind: 'function', render: Timeline }, description: 'Ordered events down a rail.' },
];
