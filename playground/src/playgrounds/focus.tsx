import { useFocus, useRuntime, useState } from '@textui/core';
import { Button, Checkbox, Column, KeyValue, Panel, Row, TextInput } from '@textui/widgets';

/**
 * Focus.
 *
 * Tab order, directional navigation and a trap, all visible at once. The
 * readout at the bottom is the focus manager's own state - if what is
 * highlighted and what it reports ever disagree, the bug is here.
 */
export function FocusPlayground() {
  const runtime = useRuntime();
  const [text, setText] = useState('');
  const [checked, setChecked] = useState(false);

  const focused = runtime.focus.focused();
  const order = runtime.focus.order();

  return (
    <Column flex={1} gap={1} padding={1}>
      <Panel title="Tab order">
        <Row gap={1}>
          <Button label="First" autoFocus />
          <Button label="Second" />
          <Button label="Third" />
          <Button label="Skipped" disabled />
        </Row>
      </Panel>

      <Panel title="Directional navigation" subtitle="arrow keys move between the cells">
        <Column gap={0}>
          <Row gap={1}>
            <Cell id="a1" /><Cell id="a2" /><Cell id="a3" />
          </Row>
          <Row gap={1}>
            <Cell id="b1" /><Cell id="b2" /><Cell id="b3" />
          </Row>
        </Column>
      </Panel>

      <Panel title="Mixed controls">
        <Row gap={2}>
          <TextInput value={text} onChange={setText} label="Text" />
          <Checkbox label="Checkbox" checked={checked} onChange={setChecked} />
        </Row>
      </Panel>

      <Panel title="Focus manager">
        <KeyValue
          items={[
            { label: 'focused', value: focused ?? '(none)', tone: focused ? 'success' : 'muted' },
            { label: 'tab order', value: String(order.length) },
            { label: 'scope', value: runtime.focus.activeScope() ?? '(root)' },
          ]}
        />
      </Panel>
    </Column>
  );
}

function Cell({ id }: { id: string }) {
  const runtime = useRuntime();
  const focus = useFocus({ id: `cell-${id}` });

  return (
    <box
      id={focus.id}
      focusable
      role="gridcell"
      label={id}
      width={7}
      border={focus.focused ? { style: 'single', color: 'focus' } : 'single'}
      bold={focus.focused}
      onKey={(event) => {
        const map = { up: 'up', down: 'down', left: 'left', right: 'right' } as const;
        const direction = map[event.name as keyof typeof map];
        if (!direction) return false;
        runtime.focus.move(direction);
        return true;
      }}
    >
      <text content={id} textAlign="center" />
    </box>
  );
}
