import { useState } from '@textui/core';
import { Column, List, Menu, Panel, Row, Table, Tabs, Tree } from '@textui/widgets';

/**
 * Component states.
 *
 * Every component that has a remembered-and-live distinction draws it side by
 * side here: one instance holding the keyboard, one that has let go of it.
 * That pair is the reason the colours moved into the theme - `List.focus` and
 * `List.selected` are two entries a theme restates independently, and so is
 * every component below.
 *
 * Tab between them. The row you leave keeps its selection and drops to the
 * dimmer fill, which is the whole of what the right-hand column is for: a
 * remembered selection saying where it is, without claiming the keyboard.
 *
 * The states that need an interaction to reach are in the panels that draw
 * them - a text field's selection needs a drag, a code viewer's needs a caret,
 * a tool row's needs a transcript. Tabs is here because its distinction is the
 * other kind: a variant, not a focus.
 */

const ITEMS = [
  { id: 'a', label: 'Alpha', description: 'the first' },
  { id: 'b', label: 'Bravo', description: 'the second' },
  { id: 'c', label: 'Charlie', description: 'the third' },
];

const PLAIN = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Bravo' },
  { id: 'c', label: 'Charlie' },
];

const NODES = [
  {
    id: 'src',
    label: 'src',
    children: [
      { id: 'index', label: 'index.ts' },
      { id: 'app', label: 'app.ts' },
    ],
  },
  { id: 'docs', label: 'docs' },
];

const COLUMNS = [{ key: 'label', header: 'Name' }];

export function StatePlayground() {
  // One value per component, so tabbing between them keeps every selection
  // where it was. That is the point: leaving a list does not move its cursor.
  const [list, setList] = useState('b');
  const [tree, setTree] = useState('src');
  const [table, setTable] = useState('b');
  const [menu, setMenu] = useState('b');
  const [tab, setTab] = useState('b');

  return (
    <Column flex={1} gap={1} padding={1}>
      <Panel title="List">
        <Row gap={2}>
          <List
            items={ITEMS}
            selectedId={list}
            onSelect={setList}
            autoFocus
            focusId="state-list"
            flex={1}
          />
          <List items={ITEMS} selectedId={list} focusable={false} flex={1} />
        </Row>
      </Panel>

      <Panel title="Table">
        <Row gap={2}>
          <Table
            columns={COLUMNS}
            rows={PLAIN}
            selectedKey={table}
            onSelect={(key) => setTable(key)}
            showHeader={false}
            flex={1}
          />
          <Table
            columns={COLUMNS}
            rows={PLAIN}
            selectedKey={table}
            focusable={false}
            showHeader={false}
            flex={1}
          />
        </Row>
      </Panel>

      <Panel title="Tree">
        <Row gap={2}>
          <Tree
            nodes={NODES}
            selectedId={tree}
            expandedIds={['src']}
            onSelect={(id) => setTree(id)}
            flex={1}
          />
          <Tree nodes={NODES} selectedId={tree} expandedIds={['src']} focusable={false} flex={1} />
        </Row>
      </Panel>

      <Panel title="Menu">
        <Row gap={2}>
          <Menu
            items={PLAIN}
            activeId={menu}
            onSelect={(id) => setMenu(id)}
            flex={1}
          />
          <Menu items={PLAIN} activeId={menu} interactive={false} flex={1} />
        </Row>
      </Panel>

      {/* Tabs states `selected` and nothing else: a tab is open, not selected,
          and dimming it when the strip does not have the keyboard would claim
          no document is open. So what varies here is the variant - and the
          state is qualified by it, `Tabs.solid.selected`. */}
      <Panel title="Tabs">
        <Column gap={0}>
          <Tabs items={PLAIN} activeId={tab} onChange={setTab} variant="solid" />
          <Tabs items={PLAIN} activeId={tab} variant="underline" />
        </Column>
      </Panel>
    </Column>
  );
}