import type { BoxProps, RenderOutput } from '@textui/core';
import { defineComponent, useTheme } from '@textui/core';
import { Feed, Row } from '@textui/widgets';
import type { Block } from '../blocks.js';
import { ChatBubble, Gutter, ReasoningBlock, StreamingText } from './bubble.js';
import { ToolCallRow } from './toolcall.js';

/**
 * The conversation, as blocks in a feed.
 *
 * There is no scrolling in this file. `Feed` owns the viewport, the cursor and
 * the tail it follows, because none of that is about chat: a transcript, an
 * activity stream and a list of search results with snippets are the same
 * problem, which is "entries that are not one line tall". What is left here is
 * the only part that *is* about chat - which block draws as what.
 */

export interface ChatTranscriptProps extends BoxProps {
  blocks: Block[];
  expanded: Record<string, boolean>;
  onToggle(id: string): void;
  /** Which block the cursor is on. Held by the screen, like every other state. */
  cursor?: number;
  onCursor?(index: number): void;
  focusId?: string;
}

export const ChatTranscript: (props: ChatTranscriptProps) => RenderOutput =
  defineComponent<ChatTranscriptProps>('ChatTranscript', (props) => {
    const {
      blocks, expanded, onToggle, cursor, onCursor, focusId = 'chat.transcript', ...rest
    } = props;

    return (
      <Feed
        focusId={focusId}
        {...(cursor !== undefined ? { selectedIndex: cursor } : {})}
        {...(onCursor ? { onSelect: onCursor } : {})}
        onActivate={(index: number) => {
          const block = blocks[index];
          if (block) onToggle(block.id);
        }}
        {...rest}
      >
        {blocks.map((block) => (
          <BlockView
            key={block.id}
            block={block}
            expanded={expanded[block.id] ?? false}
            active={cursor !== undefined && blocks[cursor]?.id === block.id}
            onToggle={() => onToggle(block.id)}
          />
        ))}
      </Feed>
    );
  });

const BlockView = defineComponent<{
  block: Block;
  expanded: boolean;
  active: boolean;
  onToggle(): void;
}>('ChatBlockView', ({ block, expanded, active, onToggle }) => {
  const theme = useTheme();

  switch (block.kind) {
    case 'said':
      // The blank row is the turn boundary. A uniform gap between every block
      // would space a paragraph from the sentence it belongs to just as much
      // as it spaces one speaker from the next.
      return (
        <ChatBubble speaker="user" padding={[1, 0, 0, 0]}>
          <text content={block.text} wrap="word" />
        </ChatBubble>
      );
    case 'header':
      return (
        <Row gap={1} padding={[1, 0, 0, 0]}>
          <text content={theme.glyphs.bulletFilled} fg={block.state === 'running' ? 'accent' : 'muted'} />
          <text content={block.model ?? 'agent'} bold fg="accent" />
          <text content={block.meta} fg="subtle" flex={1} />
          {block.state === 'cancelled' ? <text content="stopped" fg="warning" /> : null}
          {block.state === 'failed' ? <text content="failed" fg="danger" /> : null}
        </Row>
      );
    case 'prose':
      return (
        <Row gap={1}>
          <Gutter />
          <StreamingText content={block.content} streaming={block.streaming} flex={1} />
        </Row>
      );
    case 'reasoning':
      return (
        <Row gap={1}>
          <Gutter />
          <ReasoningBlock
            content={block.content}
            expanded={expanded}
            streaming={block.streaming}
            flex={1}
            {...(active ? { bg: 'selected' as const } : {})}
          />
        </Row>
      );
    case 'notice':
      return (
        <Row gap={1}>
          <text content={theme.glyphs.info} fg="info" />
          <text content={block.content} fg="muted" wrap="word" flex={1} />
        </Row>
      );
    case 'tool':
      // No gutter. A tool call is something the agent *did*, not something it
      // said, so it sits at the turn's own left edge with a status glyph where
      // the header's bullet is - rather than indented inside the rule as
      // though it were a paragraph of the answer.
      return <ToolCallRow call={block.call} expanded={expanded} active={active} onToggle={onToggle} />;
    case 'queued':
      // Not sent. It reads as a message unless it says so, and "I typed that
      // and nothing happened" is the complaint that follows.
      return (
        <Row gap={1}>
          <text content={theme.glyphs.chevronRight} fg="subtle" />
          <text content={block.text} fg="subtle" italic wrap="word" flex={1} />
          <text content="queued" fg="warning" />
        </Row>
      );
    default:
      return null;
  }
});
