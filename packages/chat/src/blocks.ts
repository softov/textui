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
