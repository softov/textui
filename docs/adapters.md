# Terminals, capabilities and adapters

## Capabilities

What a terminal can do is detected once at boot, published to `$/modus/capabilities`, and consulted by the theme and the writer rather than by components.

```ts
{
  colorDepth: 24,          // 0 | 4 | 8 | 24
  unicode: 'full',         // 'ascii' | 'bmp' | 'full'
  wideChars: true,
  mouse: true, wheel: true, focusEvents: true, paste: true,
  hyperlinks: true, clipboard: true,
  altScreen: true, cursor: true,
  synchronizedOutput: true, title: true, kittyKeyboard: false,
}
```

Detection is deliberately conservative: claiming a capability the terminal lacks corrupts the frame, while missing one only costs polish. `NO_COLOR` and `FORCE_COLOR` are honoured; `TERM=dumb` and a non-TTY both fall to the minimal set. Inside tmux or screen, hyperlinks and synchronised output are turned off because multiplexers rewrite or mangle them.

Anything detection cannot settle, an override can:

```ts
createNodeTerminal({ capabilities: { unicode: 'ascii', colorDepth: 0 } });
app.setCapabilityOverrides({ mouse: false });
```

## Managed and embedded sessions

`acquire` records exactly what it turned on, and `release` undoes exactly that and nothing else. That is the whole difference between the two modes.

```ts
// Managed: TextUI owns the terminal.
await app.start();   // alt screen, raw mode, mouse, bracketed paste, cursor hidden

// Embedded: the host already owns it.
createApp({
  terminal,
  session: { managed: false, altScreen: false, hideCursor: false },
});
```

A terminal left in raw mode with the cursor hidden is a broken shell, so the Node adapter also releases on `exit`, `SIGINT`, `SIGTERM` and `SIGHUP` - not only on a tidy `stop()`.

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
