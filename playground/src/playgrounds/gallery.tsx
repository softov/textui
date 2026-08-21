import {
  Alert, Badge, Breadcrumb, Button, Card, Checkbox, Column, Divider, Grid,
  Heading, KeyValue, Label, List, Menu, Panel, Progress, RadioGroup, Row,
  ScrollView, Select, Slider, Spinner, StatusDot, Switch, Tabs, TextInput, Timeline,
  Wizard, useState,
} from '@textui/core';
import { EVENTS } from '../data.js';

/**
 * The showcase.
 *
 * One screen per category, everything interactive, nothing faked. If a
 * component looks wrong here it is wrong - this is the page that catches a
 * theme that forgot a token or a control that lost its focus ring.
 */

const SECTIONS = [
  { id: 'display', label: 'Display' },
  { id: 'controls', label: 'Controls' },
  { id: 'data', label: 'Data' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'navigation', label: 'Navigation' },
];

export function Gallery() {
  const [section, setSection] = useState('display');

  return (
    <Column flex={1} gap={1} padding={1}>
      <Row gap={1}>
        <Heading content="TextUI" />
        <Label content="component gallery" />
      </Row>

      {/*
        * Something has to hold focus, or the keyboard has nowhere to be and
        * the page is dead until you press tab and guess.
        */}
      <Tabs items={SECTIONS} activeId={section} onChange={setSection} autoFocus />
      <Divider />

      {section === 'display' ? <DisplaySection /> : null}
      {section === 'controls' ? <ControlsSection /> : null}
      {section === 'data' ? <DataSection /> : null}
      {section === 'feedback' ? <FeedbackSection /> : null}
      {section === 'navigation' ? <NavigationSection /> : null}
    </Column>
  );
}

function DisplaySection() {
  return (
    <Column gap={1} flex={1}>
      <Panel title="Status">
        <Row gap={3}>
          <StatusDot status="up" label="up" />
          <StatusDot status="degraded" label="degraded" />
          <StatusDot status="down" label="down" />
          <StatusDot status="pending" label="pending" />
          <StatusDot status="unknown" label="unknown" />
        </Row>
      </Panel>

      <Panel title="Badges">
        <Column gap={0}>
          <Row gap={1}>
            <Badge label="default" />
            <Badge label="primary" tone="primary" />
            <Badge label="success" tone="success" />
            <Badge label="warning" tone="warning" />
            <Badge label="danger" tone="danger" />
          </Row>
          <Row gap={1}>
            <Badge label="solid" tone="primary" variant="solid" />
            <Badge label="outline" tone="success" variant="outline" />
            <Badge label="ghost" tone="danger" variant="ghost" />
          </Row>
        </Column>
      </Panel>

      {/*
        * Both of these hold more than they can show, on purpose.
        *
        * A card with one line in it proves a border draws. It says nothing
        * about what this library actually has to get right - wrapping at the
        * width it was given, rewrapping when that width changes, and letting
        * the keyboard reach the part that did not fit. Fill them, give them
        * the rest of the column, and let them scroll: now resizing the
        * terminal is a test, and tab is a test.
        */}
      {/* `stretch`, because a row centres its children by default - and a pane
        * that is only as tall as its content is a pane that never scrolls. */}
      <Row gap={1} flex={1} vAlign="stretch">
        <Card title="Card" subtitle="with a subtitle" flex={1}>
          <ScrollView flex={1}>
            <Column gap={1}>
              {CARD_TEXT.map((paragraph, i) => (
                <text key={i} content={paragraph} wrap="word" />
              ))}
            </Column>
          </ScrollView>
        </Card>

        <Panel title="Key / value" flex={1}>
          <ScrollView flex={1}>
            <KeyValue items={FACTS} />
          </ScrollView>
        </Panel>
      </Row>
    </Column>
  );
}

/**
 * Enough prose to wrap, and enough of it to overflow.
 *
 * Text that fits is text the wrapper never has to think about. These are long
 * enough that the last paragraph is below the fold at any ordinary height, so
 * a viewport that miscounts its rows shows it - which is the bug this page
 * exists to catch.
 */
const CARD_TEXT = [
  'A card is a titled box with something inside it. The something here is a paragraph long enough to wrap, because a component that only ever holds one short line has not been tested at all - it has been looked at.',
  'Wrapping happens at the width the card was given, and that width changes when the terminal does. Resize this window and the text reflows; the row count changes with it, which is what the viewport underneath has to keep up with.',
  'Scrolling is the other half. A panel with more in it than fits has a hidden bottom, and hiding it silently is worse than not having it - so this one takes focus, and tab reaches it.',
  'The last paragraph is here to be below the fold. If you can read it without scrolling, the terminal is taller than the layout expected; if you cannot reach it by scrolling, something is counting rows wrong.',
];

/** Long enough to overflow, and mixed enough to show the tones. */
const FACTS = [
  { label: 'image', value: 'billing:2.14.0' },
  { label: 'digest', value: 'sha256:9f2c1a7e4b' },
  { label: 'node', value: 'ip-10-0-2-19' },
  { label: 'zone', value: 'eu-west-1c' },
  { label: 'status', value: 'degraded', tone: 'warning' as const },
  { label: 'replicas', value: '2 of 3' },
  { label: 'restarts', value: '14', tone: 'danger' as const },
  { label: 'uptime', value: '3d 4h 12m' },
  { label: 'cpu', value: '820m / 1000m' },
  { label: 'memory', value: '1.4 GiB / 2 GiB' },
  { label: 'probe', value: 'failing', tone: 'danger' as const },
  { label: 'last deploy', value: '14:02 by fernando' },
  { label: 'commit', value: 'b6f4b62' },
  { label: 'channel', value: 'stable', tone: 'success' as const },
];

function ControlsSection() {
  const [text, setText] = useState('');
  const [checked, setChecked] = useState(true);
  const [on, setOn] = useState(false);
  const [choice, setChoice] = useState('https');
  const [level, setLevel] = useState(60);
  const [picked, setPicked] = useState<string | undefined>('b');

  return (
    <Column gap={1} flex={1}>
      <Row gap={1}>
        <Button label="Default" />
        <Button label="Primary" tone="primary" variant="solid" />
        <Button label="Danger" tone="danger" />
        <Button label="Ghost" variant="ghost" hint="ctrl+g" />
        <Button label="Disabled" disabled />
      </Row>

      <TextInput value={text} onChange={setText} label="Name" placeholder="Type here" />

      <Row gap={3}>
        <Checkbox label="Follow tail" checked={checked} onChange={setChecked} />
        <Switch label="Animations" value={on} onChange={setOn} />
      </Row>

      <RadioGroup
        label="Protocol"
        inline
        options={[
          { value: 'https', label: 'https' },
          { value: 'http', label: 'http' },
          { value: 'grpc', label: 'grpc' },
        ]}
        value={choice}
        onChange={setChoice}
      />

      <Slider label="Threshold" value={level} onChange={setLevel} format={(v) => `${v}%`} />

      <Select
        label="Region"
        options={[
          { value: 'a', label: 'eu-west-1' },
          { value: 'b', label: 'us-east-1' },
          { value: 'c', label: 'sa-east-1' },
        ]}
        value={picked}
        onChange={setPicked}
      />
    </Column>
  );
}

function DataSection() {
  const [selected, setSelected] = useState<string | undefined>('two');

  return (
    <Grid columns={2} gap={1} flex={1}>
      <Panel title="List">
        <List
          items={[
            { id: 'one', label: 'api-gateway', meta: 'up' },
            { id: 'two', label: 'billing-worker', meta: 'degraded' },
            { id: 'three', label: 'mailer', meta: 'down' },
          ]}
          selectedId={selected}
          onSelect={setSelected}
        />
      </Panel>

      <Panel title="Timeline">
        <Timeline items={EVENTS} />
      </Panel>
    </Grid>
  );
}

function FeedbackSection() {
  return (
    <Column gap={1} flex={1}>
      <Alert tone="info" title="Information" message="Nothing is wrong." />
      <Alert tone="success" title="Deployed" message="Version 2.14.0 is live." />
      <Alert tone="warning" title="Degraded" message="billing-worker is retrying." />
      <Alert tone="danger" title="Failing" message="mailer cannot reach the relay." />

      <Panel title="Progress">
        <Column gap={0}>
          <Progress label="download" value={0.35} />
          <Progress label="index" value={0.82} tone="success" />
          <Progress label="working" />
        </Column>
      </Panel>

      <Spinner label="Loading services…" />
    </Column>
  );
}

function NavigationSection() {
  const [active, setActive] = useState('overview');

  return (
    <Column gap={1} flex={1}>
      <Breadcrumb
        items={[
          { id: 'root', label: 'production' },
          { id: 'services', label: 'services' },
          { id: 'billing', label: 'billing-worker' },
        ]}
      />

      <Tabs
        items={[
          { id: 'overview', label: 'Overview' },
          { id: 'logs', label: 'Logs', badge: 12 },
          { id: 'metrics', label: 'Metrics' },
        ]}
        activeId={active}
        onChange={setActive}
        variant="solid"
      />

      <Wizard
        steps={[
          { id: 'a', label: 'Identity' },
          { id: 'b', label: 'Transport', description: 'How it is reached' },
          { id: 'c', label: 'Review' },
        ]}
        activeId="b"
        completedIds={['a']}
      />

      <Panel title="Menu">
        <Menu
          items={[
            { id: 'restart', label: 'Restart service', shortcut: 'r' },
            { id: 'rollback', label: 'Roll back', shortcut: 'ctrl+z' },
            { id: 'scale', label: 'Scale', shortcut: 's' },
            { id: 'delete', label: 'Delete', tone: 'danger', separatorBefore: true },
          ]}
        />
      </Panel>
    </Column>
  );
}
