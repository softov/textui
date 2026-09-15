import { useState } from '@textui/core';
import { FileDiff, diffLines } from '@textui/chat';
import { Button, Column, Row } from '@textui/widgets';
import { DIFF } from './fixtures.js';

/**
 * A file diff, and the three things shown instead of one.
 */
export function FileDiffPlayground() {
  const [which, setWhich] = useState<'edited' | 'new' | 'binary' | 'large'>('edited');

  return (
    <Column flex={1} gap={1} padding={1}>
      <Row gap={2}>
        <Button label="Edited" autoFocus onPress={() => setWhich('edited')} />
        <Button label="Created" onPress={() => setWhich('new')} />
        <Button label="Binary" onPress={() => setWhich('binary')} />
        <Button label="Too large" onPress={() => setWhich('large')} />
      </Row>
      {which === 'edited' ? <FileDiff path="packages/chat/src/bubble.tsx" kind="edited" diff={DIFF} flex={1} /> : null}
      {which === 'new' ? <FileDiff path="packages/chat/src/types.ts" kind="new" diff={diffLines('', 'export type Speaker = string;\n')} flex={1} /> : null}
      {which === 'binary' ? (
        <FileDiff path="media/mascot.png" kind="edited" diff={diffLines('', '')} binary={{ bytes: 48213, contentType: 'image/png' }} flex={1} />
      ) : null}
      {which === 'large' ? (
        <FileDiff path="pnpm-lock.yaml" kind="edited" diff={diffLines('a\n'.repeat(5000), 'b\n'.repeat(5000))} flex={1} />
      ) : null}
    </Column>
  );
}
