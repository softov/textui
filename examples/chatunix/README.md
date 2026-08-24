# chatunix

A chat room over a unix socket, or a port. No build step, no `--server` flag.

```bash
node index.ts --path /tmp/room --name ana     # nothing there yet: host it
node index.ts --path /tmp/room --name bob     # something there: join it
node index.ts --path 127.0.0.1:7000 --name cy # a port, same code
```

Whoever arrives first hosts the room; everyone after joins it. Messages are
JSON-RPC notifications, one per line.

| | |
|---|---|
| `enter` | Send |
| `alt+enter` | Newline - the field is a `TextArea`, so a message can be a paragraph |
| `pageup` / `pagedown` | Show more or fewer lines |
| `ctrl+c` | Leave |

## Two files, and why

`room.ts` is the transport and the wire format, with no screen in it.
`index.ts` is the interface. That line is not tidiness: it is what lets the
tests run **a server and two clients in one process** and assert that a message
crosses between them, with no terminal and no sleeping. A message arriving is
an event, so the tests wait for the event - a timeout would be slower on a fast
machine and flaky on a busy one.

```bash
pnpm --filter @textui/example-chatunix test
```

## Three things it does on purpose

**Connect before binding.** Deciding by "does the path exist" alone races: two
people starting together both find nothing and both bind. Trying to connect
first means the loser of the race gets `ECONNREFUSED` and joins.

**Take over a dead socket.** A socket file outlives the process that made it,
so a crash leaves one that looks exactly like a room until you are refused by
it. Being refused is the signal to unlink and host.

**Echo the sender through the room.** Your own message appears when the room
broadcasts it back, not when you press enter - so a message that did not arrive
never looks as though it did.

## Reading a socket

A socket delivers bytes, not messages. Two sends can arrive as one chunk and
one send can arrive as three, so `room.ts` buffers and splits on newlines.
Anything that parses a chunk as JSON works until the day it does not.

## `./room.ts`, not `./room.js`

The import names the file on disk, because there is no build and node resolves
the specifier exactly as written. `allowImportingTsExtensions` in
`tsconfig.json` is what makes TypeScript agree, and it is allowed because
nothing here emits. With a build it would be the other way round.

## Compared with [`chat`](../chat)

`chat` is the bigger one: a fake host, markdown, `Feed`, and a composer that
grows. This one is smaller and real - two processes, one socket, and no
pretend.
