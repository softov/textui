// chatunix - a chat room over a unix socket, or a port.
//
//   node index.ts --path /tmp/room --name ana     # nothing there yet: host it
//   node index.ts --path /tmp/room --name bob     # something there: join it
//   node index.ts --path 127.0.0.1:7000 --name cy # a port, same code
//
// No build step, and no `--server` flag: whoever arrives first hosts the room.
// The transport is in `room.ts`, with no screen in it, which is what lets the
// tests run two clients and a server in one process without a terminal.
//
// The import below says `./room.ts`, not `./room.js`. With a build, `.js` is
// right - it names the file that will exist. With no build there is no such
// file, and node resolves the specifier exactly as written, so it has to name
// the one on disk. `allowImportingTsExtensions` in tsconfig.json is what makes
// TypeScript agree, and it is allowed because nothing here emits.

import { h, render, useEffect, useKeymap, useState } from 'textui';
import { TextInput } from '@textui/widgets';
import { describeAddress, joinRoom, parseAddress, type Message } from './room.ts';

const flag = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

const path = flag('path');
const name = flag('name');
if (!path || !name) {
  console.error('usage: chatunix --path <socket|host:port> --name <name>');
  process.exit(2);
}

const address = parseAddress(path);
const room = await joinRoom({ address, name });

const clock = (at: number): string =>
  new Date(at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });

/** A colour per name, so who said what is legible without reading the name. */
const TONES = ['primary', 'success', 'warning', 'info', 'accent', 'secondary'] as const;
const toneFor = (who: string): (typeof TONES)[number] => {
  let hash = 0;
  for (const ch of who) hash = (hash * 31 + ch.codePointAt(0)!) % 997;
  return TONES[hash % TONES.length]!;
};

const Chat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [peers, setPeers] = useState(room.peers());
  const [rows, setRows] = useState(12);

  // Subscribing is a side effect and belongs in one, but the room outlives the
  // component, so there is nothing to unsubscribe from and nothing to clean up.
  useEffect(() => {
    room.onMessage((message) => { setMessages((all) => [...all, message]); });
    room.onPeers(setPeers);
  }, []);

  useKeymap({
    // The input has the keyboard, so these are the two it does not want.
    pageup: () => { setRows((r) => Math.min(40, r + 4)); },
    pagedown: () => { setRows((r) => Math.max(4, r - 4)); },
  });

  const send = (text: string): void => {
    const trimmed = text.trim();
    if (trimmed) room.say(trimmed);
    setDraft('');
  };

  // The last `rows` of them. A terminal has no scrollback of its own here, and
  // a list that grows past the window pushes the input off the bottom.
  const shown = messages.slice(-rows);

  return h('box', { direction: 'column', width: '100%', height: '100%', gap: 1, padding: 1 },
    h('box', { direction: 'row', gap: 1 },
      h('text', { bold: true, content: `room ${describeAddress(room.address)}` }),
      h('spacer', {}),
      h('text', {
        fg: room.role === 'server' ? 'success' : 'info',
        content: room.role === 'server' ? `hosting - ${peers} joined` : 'joined',
      }),
    ),
    h('box', { direction: 'column', flex: 1, border: 'single', padding: [0, 1] },
      ...(shown.length === 0
        ? [h('text', { dim: true, content: 'Nobody has said anything yet.' })]
        : shown.map((m, i) => h('box', { key: `${m.at}-${i}`, direction: 'row', gap: 1 },
            h('text', { dim: true, content: clock(m.at) }),
            h('text', { bold: true, fg: toneFor(m.from), content: m.from }),
            h('text', { content: m.text }),
          ))),
    ),
    h(TextInput, {
      value: draft,
      onChange: setDraft,
      onSubmit: send,
      placeholder: `say something as ${name}`,
      autoFocus: true,
    }),
    h('text', { dim: true, content: 'enter  send      pageup / pagedown  taller or shorter      ctrl+c  leave' }),
  );
};

const { waitUntilExit } = render(h(Chat, {}));
await waitUntilExit();
await room.close();
console.log(`Left ${describeAddress(address)}.`);
