// The same program as `index.ts`, in JSX.
//
// `bun index.tsx`. Not node: node strips types, it does not transform syntax,
// and `<Box/>` has to *become* a call rather than have an annotation deleted.
// It rejects the extension outright, before any flag applies.
//
// The only setup is `jsxImportSource` in tsconfig.json, pointed at `textui`
// rather than `@textui/core` so that one install is enough.

import { Box, Text, render } from 'textui';

const Hello = () => (
  <Box border="round" padding={1} direction="column" gap={1}>
    <Text bold>Hello from textui</Text>
    <Text dim>ctrl+c to quit</Text>
  </Box>
);

const { waitUntilExit } = render(<Hello />);
await waitUntilExit();
console.log('Bye.');
