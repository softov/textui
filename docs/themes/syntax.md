---
title: Syntax highlighting
parent: Themes
nav_order: 5
---

<!-- docs:setup
import { useHighlight } from '@textui/core';
import { CodeViewer } from '@textui/widgets';
import { jsonHighlighter } from '@textui/documents';
import type { Resource, SyntaxSpan } from '@textui/core';
declare const app: import('@textui/core').TextUIApp;
declare const resource: Resource;
declare const text: string;
declare const uri: string;
declare const kind: string;
-->

# Syntax highlighting

A highlighter names **scopes**, never colours. The theme owns the palette, so one JSON highlighter looks right on a dark console, a paper report and a sixteen-colour terminal without knowing that any of them exist - and a colourless terminal resolves every scope to the default foreground.

```ts
app.syntax.register(jsonHighlighter);
app.syntax.tokenize(text, { kind: 'file.data.json', uri });
```

Nothing is registered by default. A file whose kind has no highlighter is shown uncoloured rather than refused, and registering one later colours every viewer already on screen.

## Scopes

The vocabulary is closed on purpose - an open one means a theme can only guess what a highlighter will emit, and the guess is the uncoloured token nobody can explain.

```
plain     keyword   string    number   boolean   null
comment   punctuation   key    operator   type    function
tag       attribute   regexp   escape    invalid
```

Every scope has a default drawn from the semantic palette (`string` → `success`, `key` → `accent`, `comment` → `subtle`, `invalid` → `danger`, …), so a theme that says nothing about syntax still highlights. A theme states only what it wants to differ:

<!-- docs:nocheck -->
```ts
{
  id: 'midnight',
  colors: { /* ... */ },
  syntax: { string: '#98c379', key: 'accent', comment: 'subtle' },
}
```

## Writing one

Highlighters are far easier to write as a single scan over the source than as a line-aware state machine, so they score offsets and the registry does the splitting - including the newlines inside a multi-line string, which is the part a hand-written splitter always gets wrong.

```ts
import { spanHighlighter } from '@textui/core';

export const iniHighlighter = spanHighlighter({
  id: 'ini',
  kinds: ['file.data.ini'],
  extensions: ['*.ini', '*.conf'],
  scan(text) {
    const spans: SyntaxSpan[] = [];
    for (const match of text.matchAll(/^\s*([#;].*)$/gm)) {
      spans.push({ start: match.index, end: match.index + match[0].length, scope: 'comment' });
    }
    return spans;
  },
});
```

The contract the registry enforces: `tokenize(text)` returns exactly one entry per line of `text.split('\n')`, and the tokens on each line join back to that line. A highlighter that loses or invents a line would slide the whole file against its gutter, so the registry checks both and falls back to plain text rather than paint something misaligned. A highlighter that throws does the same.

Two more things a real highlighter should do, both of which the JSON one shows:

- **Colour a file that is being edited**, and therefore invalid half the time. It is a scanner, not a parser.
- **Mark what it cannot explain as `invalid`** rather than dropping it. Seeing the mistake is the point.

## Selection

`find({ kind, uri, language })` scores every registered highlighter: an explicit `language` id wins outright, then a match on the exact kind, then a match on an ancestor kind, then a filename glob, with `priority` breaking ties.

That order is what lets a viewer stay ignorant. It passes what it knows:

```tsx
<CodeViewer content={text} kind={resource.kind} uri={resource.uri} />
```

and the registry decides, or decides nothing and the file stays plain.

## In a component

```tsx
const lines = useHighlight(text, { kind, uri });   // SyntaxToken[][], memoised
```

`CodeViewer` does this itself. Reach for `useHighlight` when you are building something else that shows source - a diff, a log with embedded JSON, a preview inside a table cell.
