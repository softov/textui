// The counter, in JSX. The same program as `index.ts`, spelled differently.
//
// `bun index.tsx`. Not node: node strips types, it does not transform syntax,
// so `<Box/>` - which has to *become* a call rather than have an annotation
// deleted - is rejected at the extension, before any flag applies.
//
// The whole setup is `jsxImportSource` in tsconfig.json, pointed at `textui`
// rather than `@textui/core` so that one install is enough.

import { Box, Text, render, useInterval, useKeymap, useState } from 'textui';

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

  return (
    <Box border="round" padding={1} direction="column" gap={1} width={42}>
      <Text bold>Count: {count}</Text>
      <Text fg={running ? 'success' : 'muted'}>
        {running ? `counting up every ${STEP_MS}ms` : 'stopped'}
      </Text>
      <Box direction="column">
        <Text dim>+ / -   add or subtract one</Text>
        <Text dim>space   start or stop counting</Text>
        <Text dim>r       reset</Text>
        <Text dim>ctrl+c  quit</Text>
      </Box>
    </Box>
  );
};

render(<Counter />);
console.log('Bye.');
