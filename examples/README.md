# Examples

Two of these run with no build step at all, and four are applications with one.

## No build: `hello` and `counter`

```bash
cd examples/counter
node index.ts        # or: bun index.ts
```

Nothing compiles them. `h` is what JSX compiles to - `<Row gap={1}/>` and
`{ component: 'Row', gap: 1 }` are the same value - so a file that calls `h`
directly is a file the runtime already understands, and node has stripped types
by default since 23.6.

| | |
|---|---|
| [`hello`](hello) | The smallest thing that runs |
| [`counter`](counter) | `useKeymap`, `useState` and a timer you can pause - in `h` and in JSX |
| [`chatunix`](chatunix) | A chat room over a socket or a port. Two processes, really talking |

## Can they use JSX?

Under bun, yes, and with no build - [`counter/counter.tsx`](counter/counter.tsx) is
the same program as [`counter/index.ts`](counter/index.ts), in JSX. Under node,
no, and the reason is worth knowing because it is not a missing flag.

**Node strips types; it does not transform syntax.** A `.ts` file with no
non-erasable syntax is a file node runs by deleting the annotations. JSX is not
an annotation - `<Box/>` has to *become* a call - so node rejects `.tsx`
outright:

```
TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".tsx"
```

`--experimental-transform-types` does not help; it handles enums and
namespaces. So the trade is angle brackets against node, which is why the
counter ships both and `node index.ts` is the default.

Bun compiles TSX, and the whole setup is one line beside the file:

```json
{ "compilerOptions": { "jsxImportSource": "textui" } }
```

`textui` rather than `@textui/core`, so one install is enough - the facade
re-exports the JSX runtime for this.

## With a build: the applications

Bigger programs, bundled by esbuild because they are many files rather than
because textui needs it.

```bash
pnpm example todo        # or arcade, chat, surfaces, ink
```

| | |
|---|---|
| [`todo`](todo) | Screens, navigation, a store that persists |
| [`arcade`](arcade) | Frame loops, canvas painting, input timing |
| [`chat`](chat) | `Feed`, `TextArea`, markdown, and a fake host |
| [`surfaces`](surfaces) | An application with no shell, arranging its own chrome |
| [`ink`](ink) | `ColorText`: a colour per cell, over a banner and over prose |
| [`showcase`](showcase) | The catalog on one screen, as a row that wraps. Writes its own screenshot |
