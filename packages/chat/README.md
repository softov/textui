# @textui/chat

[![npm](https://img.shields.io/npm/v/@textui/chat?label=%40textui%2Fchat)](https://www.npmjs.com/package/@textui/chat) [![license](https://img.shields.io/npm/l/@textui/chat)](https://github.com/softov/textui/blob/main/LICENSE)

The components of an agent chat: the transcript, what is said in it, what the agent did, the composer, the block that waits on a person, the sessions and the diffs.
Built on [`@textui/core`](https://www.npmjs.com/package/@textui/core) and [`@textui/widgets`](https://www.npmjs.com/package/@textui/widgets), and on nothing that talks to a host.

```bash
npm install @textui/chat
```

```tsx
import { useState } from '@textui/core';
import { Column } from '@textui/widgets';
import { ChatComposer, ChatTranscript } from '@textui/chat';
import type { Block } from '@textui/chat';

const blocks: Block[] = [
  { kind: 'said', id: 's1', turnId: 't1', text: 'Rename the package.' },
  { kind: 'header', id: 'h2', turnId: 't2', model: 'claude', meta: '4.1s', state: 'complete' },
  { kind: 'prose', id: 'p2', turnId: 't2', content: 'Done. Three files changed.', streaming: false },
];

function Chat() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState('');
  return (
    <Column flex={1}>
      <ChatTranscript
        blocks={blocks}
        expanded={expanded}
        onToggle={(id) => setExpanded({ ...expanded, [id]: !expanded[id] })}
        flex={1}
      />
      <ChatComposer value={draft} onChange={setDraft} onSubmit={() => setDraft('')} />
    </Column>
  );
}
```

## Its own shapes

Every component takes a shape of this package's own - a `ChatToolCall`, a `ChatSession` whose status is already a word, a tone and a glyph, a `ChatPendingInput` with its questions - and nothing else.
There is no protocol here.
A client that speaks the Agent Host Protocol, or anything else, maps its records onto these and the components never learn where a session came from.
The field names follow AHP's where one exists, so that mapping is a pick rather than a rename.

Nothing is read from the store.
The markdown switch is `StreamingText`'s `markdown` prop, the draft answers of a question are `ChatHitl`'s `draft` and `onDraft`, the row under the composer is `ChatInputStatus`'s `status`, and where the composer and the waiting block sit is reported through `onMeasure`.
Whoever mounts them holds all of that, wherever it likes.

## What is here

| | |
|---|---|
| `ChatTranscript`, `Block` | The conversation as blocks in a `Feed`: said, header, prose, reasoning, notice, failure, tool, queued. `match` colours a found term through every block and `pinCursor` keeps the cursor in view while a search moves it |
| `blockText`, `findBlocks` | The words of a block, and the indexes of the blocks a query is found in, which a find walks the cursor through |
| `ChatBubble`, `Gutter`, `StreamingText`, `ReasoningBlock` | One thing said, and the two ways it is still being said |
| `ToolCallRow` | What the agent did, one row per call, opening onto its input and output. A `ChatToolCall` names its tool (`toolName`, where the id differs from the display name) and, while it runs, says what it is doing (`progress`) on the row |
| `ChatComposer`, `ComposerBar`, `ComposerOption` | The field, the slash and path menus sized to the terminal, and the control rows of chips. A `ChatCommand.hint` is drawn under the menu for the command under the cursor; a `ComposerOption.where` chip puts where the session runs on a second row, and escape on any chip is `onLeave`, back to the field |
| `ChatHitl`, `ConfirmRequest`, `QuestionForm`, `ChatInputStatus` | The block that means the agent is stopped, waiting on a person |
| `SessionList`, `ConnectionBadge` | The catalogue, and which host it came from. A `ChatSession` row says its project, branch and `pullRequest` (a label the host formats, `#412 merged`) |
| `ChatSessionHead`, `SessionDetails` | The head over a conversation, and the pane where long values are read whole |
| `FileDiff`, `diffLines`, `toLines` | One file, both sides lined up |
| `openPicker` | The command palette, anchored above the chip that asked; a command with nothing to ask is run instead |
| `settingIcon`, `valueIcon` | The marks beside a setting and beside its values, down to ascii |

## What is not here

A host connection, a controller, terminals, changesets, automations, the fake host.
Those are an application's, and the application these came from is [softov/ahpc](https://github.com/softov/ahpc).

## Runtime

No dependencies beyond `@textui/core` and `@textui/widgets`, and no `node:` imports.
Node 22+ and Bun.
