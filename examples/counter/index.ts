// A counter, driven by the keyboard.
//
// No build step: `h` is what JSX compiles to, so both node and bun run this
// file as it stands. `node index.ts`.
//
// The point of it is `useKeymap`. Keys are written the way they are written
// everywhere else in textui - the same spelling the keybinding registry uses -
// so `'ctrl+s'` is a string rather than four comparisons against a KeyEvent.

import { h, render, useKeymap, useInterval, useState } from 'textui';

const STEP_MS = 250;

const Counter = () => {
  const [count, setCount] = useState(0);
  const [running, setRunning] = useState(false);

  useKeymap({
    // `+` needs shift on most layouts, so `=` is the same key unshifted.
    '+': () => { setCount((c) => c + 1); },
    '=': () => { setCount((c) => c + 1); },
    '-': () => { setCount((c) => c - 1); },
    space: () => { setRunning((r) => !r); },
    r: () => { setCount(0); setRunning(false); },
  });

  // The third argument is the whole pause button: false and the interval is
  // not running, rather than running and ignored.
  useInterval(() => { setCount((c) => c + 1); }, STEP_MS, running);

  return h('box', { border: 'round', padding: 1, direction: 'column', gap: 1, width: 42 },
    h('text', { bold: true, content: `Count: ${count}` }),
    h('text', {
      content: running ? `counting up every ${STEP_MS}ms` : 'stopped',
      fg: running ? 'success' : 'muted',
    }),
    h('box', { direction: 'column' },
      h('text', { dim: true, content: '+ / -   add or subtract one' }),
      h('text', { dim: true, content: 'space   start or stop counting' }),
      h('text', { dim: true, content: 'r       reset' }),
      h('text', { dim: true, content: 'ctrl+c  quit' }),
    ),
  );
};

const { waitUntilExit } = render(h(Counter, {}));
await waitUntilExit();
console.log('Bye.');
