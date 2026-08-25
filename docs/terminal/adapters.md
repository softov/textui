---
title: Terminal adapters
parent: Terminal
nav_order: 3
---

<!-- docs:setup
declare const xterm: { onData(fn: (data: string) => void): void; write(data: string): void }; declare const bytesFromXterm: string; -->

# Terminal adapters

Two ship with `@textui/terminal`, and the interface is small enough that a third is a short file.

## The Node adapter

```ts
import { createNodeTerminal } from '@textui/terminal';

const terminal = createNodeTerminal({
  stdin: process.stdin,
  stdout: process.stdout,
  capabilities: { /* overrides */ },
  installExitHandlers: true,
});
```

## The virtual adapter

Three cases that turn out to be one: the test harness, an application embedded in a host that owns the real tty, and a browser-hosted terminal such as xterm.js where output goes to a callback rather than a file descriptor.

```ts
import { createVirtualTerminal } from '@textui/terminal';

const terminal = createVirtualTerminal({
  width: 80,
  height: 24,
  onWrite: (data) => xterm.write(data),
});

terminal.feed(bytesFromXterm);      // raw input, through the real decoder
terminal.resize(120, 40);
terminal.output();                  // everything written, for assertions
```

Because it is embedded by default, it does nothing to anyone's terminal.

## Writing an adapter

Implement `TerminalAdapter`: `size`, `capabilities`, `setCapabilityOverrides`, `acquire`, `release`, `write`, `flush`, `onInput`, `onResize`, and optionally `writeClipboard` and `setTitle`. Anything that can deliver bytes and accept bytes can host TextUI - an ssh session, a pty, a websocket.

## Input decoding

The decoder is a state machine over a carry buffer rather than a parser over whole strings, because a terminal splits sequences across reads. An incomplete escape sequence stays buffered and waits, which is what stops a fast paste being read as a burst of keys.

It handles the arrow and function key families, xterm modifier parameters, SGR mouse reporting including wheel and drag, bracketed paste as one event, focus in/out, and the Kitty keyboard protocol where available.
