import type { BoxProps, RenderOutput, ResolvedTheme, SemanticVariant, StyleColor } from '@textui/core';
import { defineComponent, useFrame, useTheme } from '@textui/core';
import { Column, Divider, MarkdownView, Row } from '@textui/widgets';

/**
 * One thing said, and the two ways it is still being said.
 *
 * A bubble in a terminal is not a rounded rectangle. It is a gutter that says
 * who is speaking and a body that owns the rest of the width - because the
 * width is 80 cells and half of it spent on alignment is half the conversation
 * gone.
 */

export type Speaker = 'user' | 'agent' | 'system';

export interface GutterProps extends BoxProps {
  /**
   * The transcript's cursor is on this block.
   *
   * A heavy bar in the accent colour, down the whole block. A different glyph
   * rather than only a different colour, so it survives a session without
   * colour - which a background does not.
   */
  active?: boolean;
  /**
   * No rule at rest. For the blocks that are not something said - a tool
   * row, a turn header - and still need the column, so the bar has a place
   * to be drawn and their text starts where the prose does.
   */
  blank?: boolean;
}

/**
 * The glyph the transcript's cursor is drawn with, down the left of the block
 * it is on.
 *
 * The `bold` border's left rule: the heavy line of the same family as the
 * rule at rest, from the theme, so an ascii terminal gets the glyph it can
 * draw rather than a question mark. One place, because the gutter draws it
 * and so does whatever glyph already holds a block's left column - the
 * header's bullet, the user line's chevron - while the cursor is there.
 */
export function cursorBar(theme: ResolvedTheme): string {
  return theme.borderChars('bold').left;
}

/**
 * The rule down the left of everything one speaker said.
 *
 * A box that fills rather than a `text`: the text is one row tall and the
 * paragraph beside it is nine, so a rule written as a character marks the
 * first line of a wrapped answer and abandons the rest of it.
 */
export const Gutter: (props: GutterProps) => RenderOutput = defineComponent<GutterProps>('ChatGutter', (props) => {
  const { active, blank, ...rest } = props;
  const theme = useTheme();
  const fill = active ? cursorBar(theme) : blank ? ' ' : theme.borderChars().left;
  // `alignSelf` because `Row` centres its children: a one-cell box in a
  // centred row is one cell tall, wherever the rule was meant to reach.
  return <box width={1} alignSelf="stretch" fill={fill} fg={active ? 'accent' : 'borderSubtle'} {...rest} />;
});

export interface ChatBubbleProps extends BoxProps {
  speaker: Speaker;
  /** The name, when the speaker is not enough: a model, a person, a host. */
  author?: string;
  /** Right of the author line: a time, a duration, a model. */
  meta?: string;
  tone?: SemanticVariant;
  /**
   * The transcript's cursor is on this block: the bar runs down its left
   * column, in place of the speaker's glyph on the first row and in the
   * gutter under it.
   */
  active?: boolean;
  children?: unknown;
}

const SPEAKER: Record<Speaker, { fg: StyleColor; label: string }> = {
  user: { fg: 'primary', label: 'you' },
  agent: { fg: 'accent', label: 'agent' },
  system: { fg: 'muted', label: 'system' },
};

export const ChatBubble: (props: ChatBubbleProps) => RenderOutput =
  defineComponent<ChatBubbleProps>('ChatBubble', (props) => {
    const { speaker, author, meta, tone, active, children, ...rest } = props;
    const theme = useTheme();
    const look = SPEAKER[speaker];
    const glyph = speaker === 'user' ? theme.glyphs.chevronRight
      : speaker === 'agent' ? theme.glyphs.bulletFilled
        : theme.glyphs.info;

    // The gutter is one column of glyph and one of rule. It is what makes a
    // wrapped paragraph read as one person talking rather than as the page
    // starting again, and it survives losing colour - which a tinted
    // background does not. The cursor is drawn in it for the same reason,
    // rather than as a background over what was said.
    return (
      <Column {...rest}>
        <Row gap={1}>
          {/* The glyph's cell is the block's gutter on this row, so the bar
              takes it rather than a second column before it: the block does
              not move when the cursor arrives. */}
          <text content={active ? cursorBar(theme) : glyph} fg={active ? 'accent' : tone ?? look.fg} />
          <text content={author ?? look.label} bold fg={tone ?? look.fg} />
          {meta ? <text content={meta} fg="subtle" flex={1} truncate="end" /> : <text content="" flex={1} />}
        </Row>
        <Row gap={1} flex={1}>
          <Gutter {...(active ? { active: true } : {})} />
          <Column flex={1} gap={1}>{children}</Column>
        </Row>
      </Column>
    );
  });

export interface StreamingTextProps extends BoxProps {
  content: string;
  /** Still arriving. Draws a caret and keeps it on the last word. */
  streaming?: boolean;
  quiet?: boolean;
  maxLines?: number;
  /**
   * Draw it as markdown, or as the characters that arrived.
   *
   * Markdown unless told otherwise. An application with a switch for this
   * passes it here; nothing is read from anywhere else.
   */
  markdown?: boolean;
  /** Text to pick out, for the find box. Coloured wherever it appears. */
  match?: string;
}

/**
 * Text that is still being said.
 *
 * The caret is part of the content rather than a node beside it, because a
 * caret placed after the block sits under the last line instead of at the end
 * of it - and the end of the sentence is the only place it means anything.
 *
 * It blinks on the theme's own ticker, so animation being off (a pipe, a test,
 * a `--static` capture) leaves a steady caret rather than a missing one.
 */
export const StreamingText: (props: StreamingTextProps) => RenderOutput =
  defineComponent<StreamingTextProps>('StreamingText', (props) => {
    const { content, streaming, quiet, maxLines, markdown, match, ...rest } = props;
    const theme = useTheme();
    // Only while something is arriving. A ticker marks its component dirty
    // whether or not the frame it produces differs, so an unconditional one
    // here meant every settled paragraph in the transcript asked the
    // application to redraw twice a second, for ever - a conversation that
    // got heavier to sit in the longer it got.
    const frame = useFrame(2, { enabled: streaming === true });
    const caret = streaming && frame % 2 === 0 ? theme.glyphs.caret : '';
    const rendered = markdown ?? true;
    const shown = streaming ? `${content}${caret}` : content;

    // Raw is a `text`, not a `MarkdownView` that was told not to parse: the
    // point of turning it off is to see the characters that arrived, and
    // anything that lays the document out has already decided some of them
    // were structure. `wrap` rather than truncate, because the lines being
    // read are the long ones - a fenced block and a table are exactly what is
    // wider than the pane.
    if (!rendered) {
      return (
        <text
          content={shown}
          wrap="word"
          {...(quiet ? { fg: 'muted' as const } : {})}
          {...(match ? { match } : {})}
          {...rest}
        />
      );
    }

    return (
      <MarkdownView
        content={shown}
        {...(quiet ? { quiet: true } : {})}
        {...(maxLines !== undefined ? { maxLines } : {})}
        {...(match ? { match } : {})}
        {...rest}
      />
    );
  });

export interface ReasoningBlockProps extends BoxProps {
  content: string;
  expanded?: boolean;
  streaming?: boolean;
  /** Shown collapsed: "thought for 12s". */
  summary?: string;
  /** Passed to the text once opened. */
  markdown?: boolean;
  /** Text to pick out, for the find box. Handed to the text inside it. */
  match?: string;
  /** Clicking the summary row opens it, and closes it again. */
  onToggle?(): void;
  /**
   * The transcript's cursor is on this block.
   *
   * The block takes the `selected` background and its words turn `inverted`,
   * the theme's own rule for that tone: a quiet grey on the selection blue is
   * a row you can find and cannot read.
   */
  active?: boolean;
}

/**
 * What the agent was thinking, folded away.
 *
 * Reasoning is prose the host sends like any other, and it is not what the
 * reader came for - so it is one row until it is asked for. Dropping it
 * instead loses the only account of *why* a turn did what it did.
 *
 * Open, it ends with a rule. The thought is set in the same quiet tone as the
 * answer's own gutter, and without a line under it the reader cannot tell
 * where the thinking stopped and the answer began.
 */
export const ReasoningBlock: (props: ReasoningBlockProps) => RenderOutput =
  defineComponent<ReasoningBlockProps>('ReasoningBlock', (props) => {
    const { content, expanded, streaming, summary, markdown, match, onToggle, active, ...rest } = props;
    const theme = useTheme();
    const chevron = expanded ? theme.glyphs.chevronDown : theme.glyphs.chevronRight;
    const words = content.trim().split(/\s+/).filter(Boolean).length;
    const fg = active ? 'inverted' : 'subtle';

    return (
      <Column {...rest} {...(active ? { bg: 'selected' as const } : {})}>
        <Row
          gap={1}
          {...(onToggle ? { onClick: onToggle } : {})}
          // The whole row lights up, as a tool row does: the row is the thing
          // that opens.
          style={{ hover: { bg: 'hover' } }}
        >
          <text content={chevron} fg={fg} />
          <text content={summary ?? (streaming ? 'thinking' : `thought, ${words} words`)} fg={fg} italic />
        </Row>
        {expanded ? (
          <Row gap={1}>
            <text content=" " />
            {/* `quiet` sets every run to `muted` itself, which is exactly the
                grey that vanishes on the selection; on it the text inherits
                `inverted` from here instead. */}
            <StreamingText
              content={content}
              flex={1}
              {...(active ? { fg: 'inverted' as const } : { quiet: true })}
              {...(streaming ? { streaming: true } : {})}
              {...(markdown !== undefined ? { markdown } : {})}
              {...(match ? { match } : {})}
            />
          </Row>
        ) : null}
        {expanded ? (
          // Under the text, not the chevron: the same one-cell lead the text
          // has, so the rule closes what it opened.
          <Row gap={1}>
            <text content=" " />
            <Divider flex={1} />
          </Row>
        ) : null}
      </Column>
    );
  });
