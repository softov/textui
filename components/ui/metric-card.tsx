import { defineComponent, useTheme, type BoxProps, type SemanticVariant } from '@textui/core';

/**
 * A single number, its trend, and enough context to read it.
 *
 * The sparkline is optional because a metric without history is still a
 * metric; what is not optional is the unit - a bare number on a dashboard is
 * a number nobody can act on.
 */
export interface MetricCardProps extends BoxProps {
  label: string;
  value: string | number;
  unit?: string;
  /** Recent history, oldest first. */
  history?: number[];
  /** Change since the previous period, as a fraction. */
  delta?: number;
  tone?: SemanticVariant;
}

export function MetricCard({
  label, value, unit, history, delta, tone = 'accent', ...rest
}: MetricCardProps) {
  const theme = useTheme();
  const deltaTone = delta === undefined ? 'muted' : delta >= 0 ? 'success' : 'danger';
  const deltaGlyph = delta === undefined ? '' : delta >= 0 ? theme.glyphs.arrowUp : theme.glyphs.arrowDown;

  return (
    <box direction="column" {...rest}>
      <text content={label} fg="muted" />
      <box direction="row" gap={1}>
        <text content={String(value)} bold fg={tone} />
        {unit ? <text content={unit} fg="subtle" /> : null}
        {delta !== undefined ? (
          <text
            content={`${deltaGlyph}${Math.abs(delta * 100).toFixed(0)}%`}
            fg={deltaTone}
          />
        ) : null}
      </box>
      {history?.length ? <Sparkline values={history} tone={tone} /> : null}
    </box>
  );
}

function Sparkline({ values, tone }: { values: number[]; tone: SemanticVariant }) {
  const theme = useTheme();
  const blocks = theme.glyphs.blocks;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi === lo ? 1 : hi - lo;

  const line = values
    .map((v) => blocks[Math.round(((v - lo) / span) * (blocks.length - 1))] ?? blocks[0])
    .join('');

  return <text content={line} fg={tone} />;
}

export default defineComponent('MetricCard', MetricCard);
