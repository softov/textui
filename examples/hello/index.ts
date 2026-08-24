// The smallest textui program.
//
// There is no build step and nothing to compile: `h` is what JSX compiles to,
// so a file that calls it directly is a file both node and bun will run as it
// stands. `node index.ts`.

import { h, render } from 'textui';

const Hello = () =>
  h('box', { border: 'round', padding: 1, direction: 'column', gap: 1 },
    h('text', { bold: true, content: 'Hello from textui' }),
    h('text', { dim: true, content: 'ctrl+c to quit' }),
  );

const { waitUntilExit } = render(h(Hello, {}));
await waitUntilExit();
console.log('Bye.');
