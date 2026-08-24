import {
  Alert, AreaChart, Badge, BarChart, Breadcrumb, Button, Checkbox, CodeViewer,
  Column, EmptyState, Gauge, Heading, KeyValue, Label, List, Pagination,
  Panel, Progress, Row, Select, Skeleton, Slider, Sparkline, Spinner, StatusDot,
  Switch, Tabs, TextArea, TextInput, Timeline, Toolbar, Tree,
} from '@textui/widgets';
import type { BoxProps, RenderOutput } from '@textui/core';

/**
 * The panels, and the data they are made of.
 *
 * Each is a function of nothing - no state, no store, no props. That is what
 * makes this file the screenshot: a panel that read state would look different
 * depending on when the picture was taken, and a picture that cannot be
 * reproduced is not a reference for anything.
 *
 * The controls are still real controls. They take focus, tab reaches them and
 * the keys work; what they do not have is a handler that changes what is drawn,
 * because a still of a slider at 40% is worth more than one at wherever the
 * last run left it.
 */

/** One entry in the grid. `id` is what `--only` names and what a test asserts. */
export interface Showpiece {
  id: string;
  title: string;
  /** What it is for, under the title. Kept short - it shares a line. */
  subtitle: string;
  render(): RenderOutput;
}

const CPU = [12, 18, 15, 24, 33, 28, 41, 38, 52, 47, 61, 55, 48, 39, 44, 51];
const NET = [4, 9, 7, 14, 11, 22, 19, 31, 27, 24, 18, 21, 16, 12, 15, 13];

export const PANELS: Showpiece[] = [
  {
    id: 'controls',
    title: 'Controls',
    subtitle: 'every one of them takes keys',
    render: () => (
      <Column gap={1}>
        <Row gap={1}>
          <Button label="Deploy" tone="success" hint="⏎" />
          <Button label="Cancel" />
        </Row>
        <Checkbox label="Run migrations" checked />
        <Checkbox label="Notify the channel" indeterminate />
        <Switch label="Follow logs" value />
        <Slider value={40} label="Replicas" />
      </Column>
    ),
  },
  {
    id: 'text',
    title: 'Text',
    subtitle: 'one line, and a paragraph',
    render: () => (
      <Column gap={1}>
        <TextInput value="release/4.2" label="Branch" onChange={noop} />
        <TextInput value="" search placeholder="Filter…" onChange={noop} />
        {/* A field wide enough to wrap, because the wrapping is the point: a
            TextArea soft-wraps and the caret marks the cell it is on rather
            than pushing the text along. */}
        <TextArea
          value={'Rolls the canaries first and waits for the error rate to settle before the rest.'}
          onChange={noop}
          border="single"
          maxRows={4}
        />
      </Column>
    ),
  },
  {
    id: 'choose',
    title: 'Choosing',
    subtitle: 'a value out of a set',
    render: () => (
      <Column gap={1}>
        <Select
          label="Region"
          value="eu-west-1"
          options={[
            { value: 'eu-west-1', label: 'eu-west-1', description: 'Ireland' },
            { value: 'us-east-1', label: 'us-east-1', description: 'Virginia' },
            { value: 'ap-south-1', label: 'ap-south-1', description: 'Mumbai' },
          ]}
          onChange={noop}
        />
        <Tabs
          items={[
            { id: 'over', label: 'Overview' },
            { id: 'logs', label: 'Logs', badge: 12 },
            { id: 'conf', label: 'Config' },
          ]}
          activeId="over"
        />
        <Breadcrumb
          items={[
            { id: 'org', label: 'acme' },
            { id: 'svc', label: 'checkout' },
            { id: 'env', label: 'prod' },
          ]}
        />
      </Column>
    ),
  },
  {
    id: 'status',
    title: 'Status',
    subtitle: 'the four tones, and a shape each',
    render: () => (
      <Column gap={1}>
        <Row gap={1}>
          <Badge label="live" tone="success" />
          <Badge label="canary" tone="warning" />
          <Badge label="failing" tone="danger" />
          <Badge label="4.2.1" tone="info" />
        </Row>
        <Column>
          <StatusDot status="up" label="api" />
          <StatusDot status="degraded" label="search" />
          <StatusDot status="down" label="mailer" />
          <StatusDot status="pending" label="worker" />
        </Column>
        <Row gap={1}>
          <Spinner label="draining" />
        </Row>
      </Column>
    ),
  },
  {
    id: 'progress',
    title: 'Progress',
    subtitle: 'a number, four ways',
    render: () => (
      <Column gap={1}>
        {/* `total` is 1 by default, so a percentage has to say so - without it
            72 is "72 out of 1", which clamps to full. `Gauge` is the other way
            round and reads 0-100 already. */}
        <Progress value={72} total={100} label="upload" showValue />
        <Progress value={31} total={100} label="index" tone="warning" showValue />
        <Gauge value={86} label="disk" thresholds={[{ at: 80, tone: 'danger' }]} />
        <Gauge value={12} label="quota" />
      </Column>
    ),
  },
  {
    id: 'charts',
    title: 'Charts',
    subtitle: 'a series in one row, or in a block',
    render: () => (
      <Column gap={1}>
        <Sparkline values={CPU} label="cpu" showValue />
        <Sparkline values={NET} label="net" tone="info" showValue />
        <AreaChart
          series={[{ values: CPU, label: 'cpu' }, { values: NET, label: 'net', tone: 'info' }]}
          chartHeight={5}
          axis
        />
      </Column>
    ),
  },
  {
    id: 'bars',
    title: 'Bars',
    subtitle: 'a value per label, sorted as given',
    render: () => (
      <BarChart
        data={[
          { label: '2xx', value: 8421, tone: 'success' },
          { label: '3xx', value: 1180, tone: 'info' },
          { label: '4xx', value: 412, tone: 'warning' },
          { label: '5xx', value: 37, tone: 'danger' },
        ]}
      />
    ),
  },
  {
    id: 'facts',
    title: 'Facts',
    subtitle: 'label and value, aligned',
    render: () => (
      <KeyValue
        items={[
          { label: 'image', value: 'checkout:4.2.1' },
          { label: 'replicas', value: '6 / 6', tone: 'success' },
          { label: 'restarts', value: '2', tone: 'warning' },
          { label: 'uptime', value: '19d 4h' },
          { label: 'node', value: 'ip-10-0-3-14' },
        ]}
      />
    ),
  },
  {
    id: 'list',
    title: 'A list',
    subtitle: 'rows, with a description and a meta',
    render: () => (
      <List
        focusable={false}
        items={[
          { id: '1', label: 'checkout', description: 'eu-west-1', meta: 'live', tone: 'success' },
          { id: '2', label: 'search', description: 'eu-west-1', meta: 'degraded', tone: 'warning' },
          { id: '3', label: 'mailer', description: 'us-east-1', meta: 'down', tone: 'danger' },
          { id: '4', label: 'worker', description: 'ap-south-1', meta: 'idle' },
        ]}
      />
    ),
  },
  {
    id: 'tree',
    title: 'A tree',
    subtitle: 'nested, and open where it is open',
    render: () => (
      <Tree
        focusable={false}
        expandedIds={['src']}
        nodes={[
          {
            id: 'src',
            label: 'src',
            children: [
              { id: 'src/app.ts', label: 'app.ts' },
              { id: 'src/render.ts', label: 'render.ts', meta: '4.1k' },
            ],
          },
          { id: 'test', label: 'test', hasChildren: true },
          { id: 'readme', label: 'README.md', meta: '2.2k' },
        ]}
      />
    ),
  },
  {
    id: 'timeline',
    title: 'A timeline',
    subtitle: 'what happened, in order',
    render: () => (
      <Timeline
        items={[
          { time: '09:12', title: 'Build passed', tone: 'success' },
          { time: '09:14', title: 'Canary at 5%', description: 'error rate flat' },
          { time: '09:21', title: 'Rolled to 50%', tone: 'info' },
          { time: '09:30', title: 'Latency spike', description: 'p99 1.4s', tone: 'warning' },
        ]}
      />
    ),
  },
  {
    id: 'says',
    title: 'Saying something',
    subtitle: 'the tone carries it, not the wording',
    render: () => (
      <Column gap={1}>
        <Alert tone="success" title="Deployed" message="4.2.1 is live in eu-west-1." />
        <Alert tone="warning" message="Two replicas restarted in the last hour." />
        <Alert tone="danger" title="Rollback" message="The mailer never became ready." />
      </Column>
    ),
  },
  {
    id: 'code',
    title: 'Source',
    subtitle: 'highlighted, with a gutter',
    render: () => (
      <CodeViewer
        language="ts"
        lineNumbers
        content={[
          'export function wrap(text: string) {',
          '  if (text === \'\') return [];',
          '  return text.split(/\\s+/);',
          '}',
        ].join('\n')}
      />
    ),
  },
  {
    id: 'nothing',
    title: 'Nothing yet',
    subtitle: 'an empty state, and a loading one',
    render: () => (
      <Column gap={1}>
        <EmptyState title="No deployments" message="Nothing has shipped today." hint="n to start one" />
        <Skeleton lines={3} widths={[30, 22, 14]} />
      </Column>
    ),
  },
  {
    id: 'chrome',
    title: 'Chrome',
    subtitle: 'the rows an application frames with',
    render: () => (
      <Column gap={1}>
        <Toolbar
          items={[
            { id: 'new', label: 'New', shortcut: 'ctrl+n' },
            { id: 'run', label: 'Run', shortcut: 'f5', tone: 'success' },
            { id: 'stop', label: 'Stop', disabled: true },
          ]}
        />
        <Pagination page={3} pageCount={9} />
        <Row gap={1}>
          <Heading level={3}>A heading</Heading>
        </Row>
        <Row gap={1}>
          <Label tone="muted">muted</Label>
          <Label tone="accent">accent</Label>
          <Label tone="danger">danger</Label>
        </Row>
      </Column>
    ),
  },
];

/**
 * A control with nowhere to put the change.
 *
 * Every field here is real - it takes focus and it answers keys - and none of
 * them is wired to state, because the value in the picture is the value the
 * picture is of. Passing nothing would be a different thing: a field with no
 * `onChange` is a read-only field, and these are not that.
 */
function noop(): void {
  // Deliberately empty. See above.
}

export interface PieceProps extends BoxProps {
  piece: Showpiece;
}

/**
 * One cell of the grid.
 *
 * `flex` before the spread so a caller can override it, which is the whole
 * convention: the panel says what it wants and the grid gets the last word.
 */
export function Piece({ piece, ...rest }: PieceProps): RenderOutput {
  return (
    <Panel title={piece.title} subtitle={piece.subtitle} flex={1} {...rest}>
      {piece.render()}
    </Panel>
  );
}
