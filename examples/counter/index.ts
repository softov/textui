// A counter, driven by the keyboard. The same program as `index.tsx`, spelled
// without JSX.
//
// No build step: `h` is what JSX compiles to, so both node and bun run this
// file as it stands. `node index.ts`.
//
// The point of it is `useKeymap`. Keys are written the way they are written
// everywhere else in textui - the same spelling the keybinding registry uses -
// so `'ctrl+s'` is a string rather than four comparisons against a KeyEvent.

import { h, render, useEffect, useInterval, useKeymap, useState } from 'textui';

const STEP_MS = 250;

const Counter = () => {
  const [count, setCount] = useState(0);
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);

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

  // And the same thing by hand, which is all `useInterval` is. The returned
  // function is the cleanup: it runs before the effect runs again and when the
  // component goes away, so stopping does not leave a timer behind.
  useEffect(() => {
    if (!running) return;
    setSeconds(0);
    const timer = setInterval(() => { setSeconds((s) => s + 1); }, 1000);
    return () => { clearInterval(timer); };
  }, [running]);

  // An empty dependency list means this effect never runs again, so its
  // cleanup runs once: when the component goes away. Printing from there works
  // because `stop` hands the terminal back before it disposes the tree - print
  // into the alternate screen and the terminal discards it on the way out.
  useEffect(() => () => { console.log('Finish.'); }, []);

  return h('box', { border: 'round', padding: 1, direction: 'column', gap: 1, width: 42 },
    h('box', { direction: 'row', dim: true },
      h('text', {
        bold: true,
        fg: count === 0 ? 'muted' : (count > 0 ? 'success' : 'danger'),
        content: `Count: ${count}`,
      }),
      h('spacer', {}),
      h('text', { content: `${seconds} seconds` }),
    ),
    h('text', {
      content: running ? `counting up every ${STEP_MS}ms` : 'stopped',
      fg: running ? 'success' : 'muted',
    }),
    h('box', { direction: 'column' },
      h('box', { direction: 'row', dim: true },
        h('text', { fg: '#00ff00', content: '+' }),
        h('text', { content: ' / ' }),
        h('text', { fg: '#ff0000', content: '-' }),
        h('text', { content: '   add or subtract one' }),
      ),
      h('text', { dim: true, content: 'space   start or stop counting' }),
      h('text', { dim: true, content: 'r       reset' }),
      h('text', { dim: true, content: 'ctrl+c  quit' }),
    ),
  );
};

const { waitUntilExit } = render(h(Counter, {}));
await waitUntilExit();
console.log('Bye.');
