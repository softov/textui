import type { BoxProps, RenderOutput, SemanticVariant } from '@textui/core';
import { defineComponent, useTheme } from '@textui/core';
import { Badge, Column, MarkdownView, Row } from '@textui/widgets';
import type { ToolCall } from '../ahp/types.js';

/**
 * A tool call, as a row.
 *
 * Twenty of these in a turn look identical unless the *command* is on the row,
 * so the input is the row and the display name is a prefix. What it meant to
 * do is markdown, like everything else a host writes for a person; what came
 * back is not, and is shown as it arrived.
 *
 * The status is a glyph and a colour together. A 16-colour session, a piped
 * log and a colourblind reader all lose the colour and keep the glyph.
 */

export interface ToolCallRowProps extends BoxProps {
  call: ToolCall;
  expanded?: boolean;
  /** The transcript's cursor is on this row. */
  active?: boolean;
}

type StatusGlyph = 'bulletHollow' | 'bulletHalf' | 'bulletFilled' | 'check' | 'cross';

const LOOK: Record<string, { tone: SemanticVariant; glyph: StatusGlyph }> = {
  pending: { tone: 'muted', glyph: 'bulletHollow' },
  'pending-confirmation': { tone: 'warning', glyph: 'bulletHalf' },
  running: { tone: 'accent', glyph: 'bulletFilled' },
  completed: { tone: 'success', glyph: 'check' },
  failed: { tone: 'danger', glyph: 'cross' },
  cancelled: { tone: 'muted', glyph: 'cross' },
};

export const ToolCallRow: (props: ToolCallRowProps) => RenderOutput =
  defineComponent<ToolCallRowProps>('ToolCallRow', (props) => {
    const { call, expanded, active, ...rest } = props;
    const theme = useTheme();
    const look = LOOK[call.status] ?? { tone: 'muted' as SemanticVariant, glyph: 'bulletHollow' as StatusGlyph };
    const glyph = theme.glyphs[look.glyph];
    const chevron = expanded ? theme.glyphs.chevronDown : theme.glyphs.chevronRight;
    const failed = call.status === 'failed' || (call.exitCode !== undefined && call.exitCode !== 0);

    return (
      <Column {...rest} {...(active ? { bg: 'selected' as const } : {})}>
        <Row gap={1}>
          <text content={chevron} fg="subtle" />
          <text content={glyph} fg={look.tone} />
          <text content={call.name} bold />
          <text content={call.input ?? call.intention ?? ''} fg="muted" flex={1} truncate="middle" />
          {call.status === 'pending-confirmation' ? <Badge label="asks" tone="warning" icon={theme.glyphs.warning} /> : null}
          {failed ? <Badge label={`exit ${call.exitCode ?? 1}`} tone="danger" /> : null}
        </Row>

        {expanded ? (
          <Column padding={[0, 0, 0, 4]} gap={0}>
            {call.intention ? <MarkdownView content={call.intention} quiet /> : null}
            {call.input ? (
              <Column bg="surfaceAlt" padding={[0, 1]}>
                <text content={call.input} fg="text" wrap="word" />
              </Column>
            ) : null}
            {call.output ? (
              <Column>
                {call.output.split('\n').slice(0, 12).map((line, i) => (
                  <text key={i} content={line} fg="muted" truncate="end" />
                ))}
                {call.output.split('\n').length > 12 ? (
                  <text content={`${theme.glyphs.ellipsis} ${call.output.split('\n').length - 12} more lines`} fg="subtle" />
                ) : null}
              </Column>
            ) : null}
            {call.files && call.files.length > 0 ? (
              <Column>
                {call.files.map((file) => (
                  <text key={file} content={`${theme.glyphs.chevronRight} ${file}`} fg="info" />
                ))}
              </Column>
            ) : null}
            {call.outcome ? <text content={call.outcome} fg="subtle" /> : null}
          </Column>
        ) : null}
      </Column>
    );
  });
