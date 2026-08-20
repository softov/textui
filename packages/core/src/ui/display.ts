import type { ComponentDefinition } from '../types/component-registry.js';
import type { BoxProps, TextProps } from '../jsx/intrinsics.js';
import type { SemanticVariant, StyleColor, SurfaceVariant } from '../types/style.js';
import { h, defineComponent } from '../jsx/factory.js';
import { ON_TONE, TONE as TONE_COLOR } from './tone.js';
import { useFrame, useTheme } from '../runtime/hooks.js';
import { stringWidth } from '../util/text.js';

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
  const { label, tone = 'default', variant = 'soft', icon, ...rest } = props;
  const color = TONE_COLOR[tone];

  const style =
    variant === 'solid' ? { bg: color, fg: ON_TONE[tone] }
      : variant === 'ghost' ? { fg: color, dim: true }
        : { fg: color };

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
}

/**
 * A progress bar with sub-cell resolution: the partial block glyphs give eight
 * steps per cell, so a 20-cell bar moves smoothly rather than in 5% jumps.
 */
export const Progress = defineComponent<ProgressProps>('Progress', (props) => {
  const theme = useTheme();
  const { value, total = 1, label, showValue = true, tone = 'primary', barWidth, ...rest } = props;
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
    label ? h('text', { content: label, fg: 'muted' }) : null,
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
  { component: 'Badge', category: 'display', renderer: { kind: 'function', render: Badge }, variants: ['solid', 'outline', 'ghost', 'soft'], description: 'Small status marker; carries a glyph as well as a colour.' },
  { component: 'StatusDot', category: 'display', renderer: { kind: 'function', render: StatusDot }, role: 'status', description: 'The shared status vocabulary: up, degraded, down.' },
  { component: 'Alert', category: 'feedback', renderer: { kind: 'function', render: Alert }, role: 'alert', description: 'A message with an icon and a tone.' },
  { component: 'Card', category: 'display', renderer: { kind: 'function', render: Card }, description: 'Bordered block with a title.' },
  { component: 'KeyValue', category: 'data', renderer: { kind: 'function', render: KeyValue }, description: 'Aligned label/value pairs.' },
  { component: 'Progress', category: 'feedback', renderer: { kind: 'function', render: Progress }, role: 'progressbar', description: 'Determinate or indeterminate bar, sub-cell resolution.' },
  { component: 'Spinner', category: 'feedback', renderer: { kind: 'function', render: Spinner }, role: 'status', description: 'Animated activity indicator.' },
  { component: 'Skeleton', category: 'feedback', renderer: { kind: 'function', render: Skeleton }, description: 'Loading placeholder.' },
  { component: 'EmptyState', category: 'feedback', renderer: { kind: 'function', render: EmptyState }, description: 'Nothing here, and what to do about it.' },
  { component: 'ErrorState', category: 'feedback', renderer: { kind: 'function', render: ErrorState }, role: 'alert', description: 'A failure, with its message.' },
  { component: 'Timeline', category: 'data', renderer: { kind: 'function', render: Timeline }, description: 'Ordered events down a rail.' },
];
