// The counter, in JSX. The same program as `index.ts`, spelled differently.
//
// `bun index.tsx`. Not node: node strips types, it does not transform syntax,
// so `<Box/>` - which has to *become* a call rather than have an annotation
// deleted - is rejected at the extension, before any flag applies.
//
// The whole setup is `jsxImportSource` in tsconfig.json, pointed at `textui`
// rather than `@textui/core` so that one install is enough.

import { Box, Spacer, Text, render, useEffect, useInterval, useKeymap, useState } from 'textui';

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
    return () => {
      clearInterval(timer);
    };
  }, [running]);

  // An empty dependency list means this effect never runs again, so its
  // cleanup runs once: when the component goes away. Printing from there
  // works because `stop` hands the terminal back before it disposes the
  // tree - print into the alternate screen and the terminal discards it on
  // the way out.
  useEffect(() => () => { console.log('Finish.'); }, []);

  return (
    <Box border="round" padding={1} direction="column" gap={1} width={42}>
      <Box direction="row" dim>
        <Text bold fg={count === 0 ? 'muted' : (count > 0 ? 'success' : 'danger')}>Count: {count}</Text>
        <Spacer />
        <Text>{seconds} seconds</Text>
      </Box>
      <Text fg={running ? 'success' : 'muted'}>
        {running ? `counting up every ${STEP_MS}ms` : 'stopped'}
      </Text>
      <Box direction="column">
        <Box direction="row" dim>
          <Text fg="#00ff00">+</Text>
          <Text> / </Text>
          <Text fg="#ff0000">-</Text>
          <Text>   add or subtract one</Text>
        </Box>
        <Text dim>space   start or stop counting</Text>
        <Text dim>r       reset</Text>
        <Text dim>ctrl+c  quit</Text>
      </Box>
    </Box>
  );
};

const { waitUntilExit } = render(<Counter />);
await waitUntilExit();
console.log('Bye.');