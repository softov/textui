import type { BoxProps, RenderOutput } from '@textui/core';
import { defineComponent, useApp, useStoreValue } from '@textui/core';
import { Badge, KeyValue, List, Row } from '@textui/widgets';

/**
 * The things that get mounted.
 *
 * Deliberately dull: this example is about where a component ends up and who
 * decides, not about what it draws. Each one is a plain registered component,
 * which is the only kind of thing a mount target can be.
 */

const LAYOUT_PATH = '$/demo/canvasLayout';

export const Toolbar: (props: BoxProps) => RenderOutput = defineComponent<BoxProps>('DemoToolbar', (props) => (
  <Row {...props} gap={2}>
    <text content="surfaces" bold />
    <text content="no shell registered" fg="muted" />
    <spacer flex={1} />
    <text content="1 region  2 tabs  3 stack" fg="subtle" />
    <text content="q quit" fg="subtle" />
  </Row>
));

export const Status: (props: BoxProps) => RenderOutput = defineComponent<BoxProps>('DemoStatus', (props) => {
  const layout = useStoreValue<string>(LAYOUT_PATH) ?? 'region';
  return (
    <Row {...props} gap={2}>
      <text content="canvas layout:" fg="muted" />
      <Badge label={layout} tone="primary" />
      <spacer flex={1} />
      <text content="every region here is a surface this app named itself" fg="subtle" />
    </Row>
  );
});

/** The nav. Its items do nothing; it is here to occupy a surface. */
export const Nav: (props: BoxProps) => RenderOutput = defineComponent<BoxProps>('DemoNav', (props) => (
  <List
    {...props}
    items={[
      { id: 'overview', label: 'Overview' },
      { id: 'detail', label: 'Detail' },
      { id: 'history', label: 'History' },
    ]}
  />
));

/** Mounted into `inspector`, which is itself mounted into `nav`. */
export const Inspector: (props: BoxProps) => RenderOutput = defineComponent<BoxProps>('DemoInspector', (props) => {
  const app = useApp();
  return (
    <KeyValue
      {...props}
      items={[
        { label: 'surface', value: 'inspector' },
        { label: 'mounted in', value: 'nav' },
        // Whatever this app asked for. Nothing is registered under it, which
        // is what sends the runtime down its no-shell path.
        { label: 'shell', value: app.activeShell() },
      ]}
    />
  );
});

/** One region of the canvas. The text says which, because that is the point. */
type RegionProps = BoxProps & { name: string; note: string };

export const Region: (props: RegionProps) => RenderOutput = defineComponent<RegionProps>(
  'DemoRegion',
  ({ name, note, ...rest }) => (
    <box {...rest} direction="column" border="single" padding={[0, 1]} title={name}>
      <text content={note} fg="muted" />
    </box>
  ),
);
