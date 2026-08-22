import {
  Alert, Badge, Breadcrumb, Button, Card, Checkbox, Column, Divider, Feed, Grid,
  Heading, KeyValue, Label, List, MarkdownView, Menu, Panel, Progress, RadioGroup,
  Row, ScrollView, Select, Slider, Spinner, StatusDot, Switch, Tabs,
  TextInput, Timeline, Wizard, useState,
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
  { id: 'typography', label: 'Type' },
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
      {section === 'typography' ? <TypographySection /> : null}
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
      {/* Half each, stated rather than flexed: `flex` grows from natural size,
        * and four paragraphs of prose have a natural width of one very long
        * line - so the card took the row and left the facts a gutter. */}
      <Row gap={1} flex={1} vAlign="stretch">
        <Card title="Card" subtitle="with a subtitle" width="50%">
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

/** A border and its padding: where a bordered control's label starts. */
const BORDERED_INSET = 2;

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
        <Button label="Primary" tone="primary" />
        <Button label="Secondary" tone="secondary" />
        <Button label="Success" tone="success" />
        <Button label="Info" tone="info" />
        <Button label="Warning" tone="warning" />
        <Button label="Danger" tone="danger" />
        <Button label="Disabled" disabled />
      </Row>
      {/* The three sizes, so the row above has something to be compared to. */}
      <Row gap={1} vAlign="center">
        <Button label="Small" tone="primary" variant="solid" size="sm" />
        <Button label="Medium" tone="primary" variant="solid" />
        <Button label="Large" tone="primary" variant="solid" size="lg" />
        <Button label="Small" size="sm" />
        <Button label="Medium" />
        <Button label="Large" size="lg" />
      </Row>
      <Row gap={1}>
        <Button label="Default" variant="solid" />
        <Button label="Primary" tone="primary" variant="solid" />
        <Button label="Secondary" tone="secondary" variant="solid" />
        <Button label="Disabled" disabled variant="solid" />
        <Button label="Success" tone="success" variant="solid" />
        <Button label="Info" tone="info" variant="solid" />
        <Button label="Warning" tone="warning" variant="solid" />
        <Button label="Danger" tone="danger" variant="solid" />
      </Row>
      <Row gap={1}>
        <Button label="Default" variant="outline" />
        <Button label="Primary" tone="primary" variant="outline" />
        <Button label="Secondary" tone="secondary" variant="outline" />
        <Button label="Disabled" disabled variant="outline" />
        <Button label="Success" tone="success" variant="outline" />
        <Button label="Warning" tone="warning" variant="outline" />
        <Button label="Info" tone="info" variant="outline" />
        <Button label="Danger" tone="danger" variant="outline" />
      </Row>
      <Row gap={1}>
        <Button label="Default" variant="ghost" />
        <Button label="Primary" tone="primary" variant="ghost" />
        <Button label="Secondary" tone="secondary" variant="ghost" />
        <Button label="Disabled" disabled variant="ghost" />
        <Button label="Success" tone="success" variant="ghost" />
        <Button label="Info" tone="info" variant="ghost" />
        <Button label="Danger" tone="danger" variant="ghost" />
        <Button label="Warning" tone="warning" variant="ghost" />
      </Row>

      <TextInput value={text} onChange={setText} label="Name" placeholder="Type here" />

      {/*
        * Indented to the same column the bordered controls put their labels
        * in.
        *
        * A field with a border sets its label one cell inside the frame and
        * one more inside the padding, so "Name" and "Region" start two cells
        * further right than a checkbox does. Read down the column and nothing
        * lines up - the labels of one kind of control sit in a different place
        * from the labels of the other, for no reason a reader can see.
        */}
      <Column gap={1} padding={{ left: BORDERED_INSET }}>
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
      </Column>

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
  const [entry, setEntry] = useState(0);

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

      <Panel title="MarkdownView">
        <MarkdownView content={NOTE} />
      </Panel>

      {/* Entries of different heights, a cursor that moves between them, and a
        * tail it follows - none of which `List` does, and all of which a
        * transcript, an activity stream and a result list all want.
        *
        * A height, because that is what asks it to fill and scroll. Left to
        * the content it would draw all four and grow, which is the same
        * component and the other half of the rule. */}
      <Panel title="Feed" meta="follows the tail">
        <Feed height={6} selectedIndex={entry} onSelect={setEntry}>
          {ENTRIES.map((text, i) => (
            <Row key={i} gap={1} {...(entry === i ? { bg: 'selected' as const } : {})}>
              <text content={`${i + 1}`} fg="subtle" />
              <text content={text} wrap="word" flex={1} />
            </Row>
          ))}
        </Feed>
      </Panel>
    </Grid>
  );
}

const NOTE = [
  '## What a feed is for',
  '',
  'Entries that are **not one line tall** - a message, a result with a snippet,',
  'a file whose diff expands. `List` cannot, because its rows are one line.',
  '',
  '- measured, not computed',
  '- follows the tail until you scroll',
].join('\n');

const ENTRIES = [
  'A short one.',
  'A longer entry that wraps onto several rows, which is the point: a feed measures what it drew.',
  'Another short one.',
  'And one more, so there is something below the fold.',
];

function FeedbackSection() {
  return (
    <Column gap={1} flex={1}>
      <Alert tone="info" title="Information" message="Nothing is wrong." />
      <Alert tone="success" title="Deployed" message="Version 2.14.0 is live." />
      <Alert tone="warning" title="Degraded" message="billing-worker is retrying." />
      <Alert tone="danger" title="Failing" message="mailer cannot reach the relay." />

      <Panel title="Progress">
        <Column gap={0}>
          {/* One gutter for the three, so the tracks start at one column
            * rather than wherever each label happens to end. */}
          <Progress label="download" value={0.35} labelWidth={9} />
          <Progress label="index" value={0.82} tone="success" labelWidth={9} />
          <Progress label="working" labelWidth={9} />
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

/**
 * Type.
 *
 * Every wrap mode on one string, at one width, so the difference between them
 * is a thing you can see rather than a sentence in the docs. The width is
 * fixed rather than flexible for the same reason: a truncation that only shows
 * up on a narrow terminal is a truncation nobody reviews.
 */
const SAMPLE = 'Deployment finished in 4m 12s across eleven regions.';

const WRAP_MODES = [
  { mode: 'none', note: 'one row, clipped at the edge' },
  { mode: 'word', note: 'breaks between words' },
  { mode: 'char', note: 'fills every row, breaks words' },
  { mode: 'truncate', note: 'alias of truncate-end' },
  { mode: 'truncate-start', note: 'the tail is what matters' },
  { mode: 'truncate-middle', note: 'both ends kept' },
  { mode: 'truncate-end', note: 'the usual one' },
] as const;

const COLUMN = 26;

function TypographySection() {
  return (
    <ScrollView flex={1}>
      <Column gap={1}>
        <Panel title="Wrap" subtitle={`${COLUMN} columns, one string`}>
          <Column gap={1}>
            {WRAP_MODES.map(({ mode, note }) => (
              <Row key={mode} gap={1} vAlign="start">
                <Label content={mode} width={16} />
                <box width={COLUMN} border="single" padding={[0, 1]}>
                  <text content={SAMPLE} wrap={mode} />
                </box>
                <Label content={note} fg="muted" flex={1} wrap="word" />
              </Row>
            ))}
          </Column>
        </Panel>

        <Panel title="Align">
          <Row gap={1}>
            {(['left', 'center', 'right'] as const).map((align) => (
              <box key={align} flex={1} border="single" padding={[0, 1]}>
                <text content={align} textAlign={align} />
                <text content="the quick brown fox" textAlign={align} wrap="word" fg="muted" />
              </box>
            ))}
          </Row>
        </Panel>

        <Panel title="Emphasis">
          <Column>
            <Heading content="Heading" />
            <text content="plain" />
            <text content="bold" bold />
            <text content="dim" dim />
            <text content="italic" italic />
            <text content="underline" underline />
            <text content="strike" strike />
            <text content="inverse" inverse />
            <Row gap={1}>
              <text content="ellipsis, explicitly:" fg="muted" />
              <box width={14}>
                <text content="truncated here" wrap="truncate" ellipsis=".." />
              </box>
            </Row>
          </Column>
        </Panel>

        {/*
          * `flexWrap` is the only thing on this page that is about the box
          * rather than the text, and it belongs here anyway: a row of words
          * that will not wrap is the commonest way a terminal layout breaks.
          */}
        <Panel title="flexWrap" subtitle="a row that runs out of room">
          <Column gap={1}>
            <Row gap={1} flexWrap="wrap">
              {SAMPLE.split(' ').map((word, i) => (
                <Badge key={i} label={word} tone={i % 3 === 0 ? 'info' : 'muted'} />
              ))}
            </Row>
            <Divider />
            <Row gap={1}>
              {SAMPLE.split(' ').slice(0, 6).map((word, i) => (
                <Badge key={i} label={word} tone="muted" />
              ))}
              <Label content="nowrap: the rest is off the edge" fg="muted" />
            </Row>
          </Column>
        </Panel>

        <Panel title="Border colours" subtitle="one colour per edge, and a dim frame">
          <Row gap={2}>
            <box
              width={22}
              padding={[0, 1]}
              border={{ style: 'single', colors: { top: 'success', bottom: 'danger' } }}
            >
              <text content="top and bottom" />
            </box>
            <box width={22} padding={[0, 1]} border={{ style: 'round', dim: true }}>
              <text content="dim frame, plain text" wrap="word" />
            </box>
          </Row>
        </Panel>
      </Column>
    </ScrollView>
  );
}
