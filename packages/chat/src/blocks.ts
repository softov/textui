import type { ChatToolCall } from './types.js';

/**
 * What the transcript draws, one entry per row group.
 *
 * A turn is not a block: an agent turn is a header, some prose, a reasoning
 * fold and a row per tool call, and each of those scrolls, folds and selects
 * on its own. The client that owns the turns turns them into these.
 */
export type Block =
  | { kind: 'said'; id: string; turnId: string; text: string }
  | {
    kind: 'header'; id: string; turnId: string; model?: string;
    settings?: string;
    meta: string; state: 'running' | 'complete' | 'cancelled' | 'failed';
  }
  | { kind: 'prose'; id: string; turnId: string; content: string; streaming: boolean }
  | { kind: 'reasoning'; id: string; turnId: string; content: string; streaming: boolean }
  | { kind: 'notice'; id: string; turnId: string; content: string }
  | { kind: 'failure'; id: string; turnId: string; content: string; resumable: boolean }
  | { kind: 'tool'; id: string; turnId: string; call: ChatToolCall }
  | { kind: 'queued'; id: string; messageId: string; text: string };

/** The blocks a cursor can land on: the ones that open, or can be withdrawn. */
export function selectable(block: Block): boolean {
  return block.kind === 'tool' || block.kind === 'reasoning' || block.kind === 'queued';
}

/**
 * Everything in a block that a person could be looking for.
 *
 * A tool call is its name, its command and what came back, because all three
 * are things somebody searches a transcript for - the file a command touched
 * is in the output and nowhere else. A header is the model and the settings,
 * which is how "where did I switch to opus" is answered.
 */
export function blockText(block: Block): string {
  switch (block.kind) {
    case 'said':
    case 'queued':
      return block.text;
    case 'prose':
    case 'reasoning':
    case 'notice':
    case 'failure':
      return block.content;
    case 'header':
      return [block.model, block.settings, block.meta].filter(Boolean).join(' ');
    case 'tool':
      return [
        block.call.name, block.call.toolName, block.call.input,
        block.call.intention, block.call.outcome, block.call.output,
        ...(block.call.files ?? []),
      ].filter(Boolean).join(' ');
  }
}

/**
 * Where in the conversation a query appears, as block indices in order.
 *
 * Case-insensitive, and a blank query matches nothing rather than everything:
 * a find with no term is a find that has not been typed yet, and lighting up
 * every block for it is the opposite of what the box is for.
 */
export function findBlocks(blocks: Block[], query: string): number[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') return [];
  const found: number[] = [];
  blocks.forEach((block, index) => {
    if (blockText(block).toLowerCase().includes(needle)) found.push(index);
  });
  return found;
}
