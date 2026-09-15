import type { Block, ChatPendingInput, ChatSession, ChatToolCall, DiffResult } from '@textui/chat';
import { diffLines } from '@textui/chat';

/**
 * One conversation's worth of fixtures, shared by the chat playgrounds.
 *
 * Static on purpose: a playground is looked at and mounted by the suite, and
 * what it needs is every shape the components draw, not a host.
 */

export const CALLS: ChatToolCall[] = [
  { id: 'c1', name: 'Read', status: 'completed', input: 'packages/chat/src/index.ts', output: 'export * from ...' },
  {
    id: 'c2', name: 'Bash', status: 'running', input: 'pnpm --filter @textui/chat test',
    intention: 'Run the package suite',
  },
  {
    id: 'c3', name: 'Bash', status: 'failed', input: 'pnpm lint', exitCode: 1,
    output: '3 problems (1 error, 2 warnings)', outcome: 'Lint found an unused import',
  },
  {
    id: 'c4', name: 'Edit', status: 'pending-confirmation', input: 'packages/chat/src/hitl.tsx',
    confirmationTitle: 'Edit this file?', intention: 'Drop the store path from the question form',
    options: [{ id: 'once', label: 'Just this once' }, { id: 'session', label: 'For this session' }],
    files: ['packages/chat/src/hitl.tsx'],
  },
  { id: 'c5', name: 'Grep', status: 'cancelled', input: 'useStoreValue' },
  { id: 'c6', name: 'Write', status: 'pending', input: 'packages/chat/README.md' },
];

export const BLOCKS: Block[] = [
  { kind: 'said', id: 's1', turnId: 't1', text: 'Move the chat components into their own package, with their own prop types.' },
  { kind: 'header', id: 'h2', turnId: 't2', model: 'claude-opus-5', settings: 'thinking: high', meta: '48.2s', state: 'complete' },
  { kind: 'reasoning', id: 'r2', turnId: 't2', content: 'The components read four store paths. Each becomes a prop, and the client that owns the store passes them down.', streaming: false },
  { kind: 'prose', id: 'p2', turnId: 't2', content: 'I will start with the **types**, then move each component and its tests.\n\n- `types.ts` first\n- then `bubble.tsx`', streaming: false },
  { kind: 'tool', id: 'c1', turnId: 't2', call: CALLS[0] as ChatToolCall },
  { kind: 'tool', id: 'c3', turnId: 't2', call: CALLS[2] as ChatToolCall },
  { kind: 'notice', id: 'n2', turnId: 't2', content: 'Context compacted at 120k tokens.' },
  { kind: 'said', id: 's3', turnId: 't3', text: 'Now the tests.' },
  { kind: 'header', id: 'h4', turnId: 't4', model: 'claude-opus-5', meta: 'running', state: 'running' },
  { kind: 'prose', id: 'p4', turnId: 't4', content: 'Running the suite', streaming: true },
  { kind: 'tool', id: 'c2', turnId: 't4', call: CALLS[1] as ChatToolCall },
  { kind: 'failure', id: 'f4', turnId: 't4', content: 'The host closed the connection.', resumable: true },
  { kind: 'queued', id: 'q1', messageId: 'm1', text: 'And then update the docs.' },
];

export const SESSIONS: ChatSession[] = [
  {
    id: 'ahp-session://one',
    title: 'Lift the chat components into @textui/chat',
    provider: 'claude',
    status: { activity: 'running', archived: false, read: true, label: 'running', tone: 'accent', glyph: 'bulletFilled' },
    createdAt: '2026-09-16T08:00:00Z',
    modifiedAt: '2026-09-16T09:30:00Z',
    workingDirectories: ['file:///home/me/textui'],
    project: 'textui',
    branch: 'main',
    activity: 'writing tests',
    changes: { files: 14, additions: 820, deletions: 31 },
  },
  {
    id: 'ahp-session://two',
    title: 'Answer the question about the release order',
    provider: 'codex',
    status: { activity: 'input', archived: false, read: false, label: 'needs you', tone: 'warning', glyph: 'bulletHalf' },
    createdAt: '2026-09-15T14:00:00Z',
    modifiedAt: '2026-09-16T07:10:00Z',
    workingDirectories: ['file:///home/me/ahpc'],
    project: 'ahpc',
    branch: 'main',
  },
  {
    id: 'ahp-session://three',
    title: 'Nightly dependency check',
    provider: 'claude',
    status: { activity: 'error', archived: false, read: true, label: 'failed', tone: 'danger', glyph: 'cross' },
    createdAt: '2026-09-16T03:00:00Z',
    modifiedAt: '2026-09-16T03:02:00Z',
    workingDirectories: ['file:///home/me/textui'],
    project: 'textui',
    origin: 'by an automation',
  },
  {
    id: 'ahp-session://four',
    title: 'Old spike on the feed cursor',
    provider: 'claude',
    status: { activity: 'idle', archived: true, read: true, label: 'idle', tone: 'muted', glyph: 'bulletHollow' },
    createdAt: '2026-08-02T10:00:00Z',
    modifiedAt: '2026-08-02T12:00:00Z',
    workingDirectories: ['file:///home/me/textui'],
    project: 'textui',
  },
];

export const CONFIRM: ChatPendingInput = { kind: 'toolConfirmation', id: 'i1', call: CALLS[3] as ChatToolCall };

export const ASK: ChatPendingInput = {
  kind: 'chatInput',
  id: 'i2',
  message: 'Before I rewire ahpc, a few things I cannot decide alone.',
  questions: [
    { id: 'links', kind: 'single-select', message: 'How should ahpc depend on the package?', required: true, options: [
      { id: 'file', label: 'file: links now, ^0.6.0 at release' },
      { id: 'published', label: 'Wait for the release' },
    ] },
    { id: 'suites', kind: 'multi-select', message: 'Which suites move?', options: [
      { id: 'composer', label: 'composer' }, { id: 'toolcall', label: 'toolcall' }, { id: 'details', label: 'details' },
    ] },
    { id: 'playgrounds', kind: 'boolean', message: 'One playground per component?' },
    { id: 'why', kind: 'text', message: 'Anything else I should know?' },
    { id: 'count', kind: 'number', message: 'How many rows should the picker show?' },
  ],
};

export const DIFF: DiffResult = diffLines(
  [
    "import { defineComponent, useStoreValue, useTheme } from '@textui/core';",
    "import { MARKDOWN } from '../state.js';",
    '',
    'export const StreamingText = defineComponent((props) => {',
    '  const preference = useStoreValue(MARKDOWN, true) ?? true;',
    '  const rendered = props.markdown ?? preference;',
    '  return rendered ? markdown(props) : raw(props);',
    '});',
    '',
  ].join('\n'),
  [
    "import { defineComponent, useTheme } from '@textui/core';",
    '',
    'export const StreamingText = defineComponent((props) => {',
    '  const rendered = props.markdown ?? true;',
    '  return rendered ? markdown(props) : raw(props);',
    '});',
    '',
  ].join('\n'),
);
