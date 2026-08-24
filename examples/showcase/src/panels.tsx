import {
  Alert, AreaChart, Badge, BarChart, Breadcrumb, Button, Checkbox, CodeViewer,
  Column, EmptyState, Gauge, Heading, KeyValue, Label, List, Pagination,
  Heatmap, MarkdownView, Panel, Progress, Row, Select, Skeleton, Slider, Sparkline,
  Spinner, StatusDot,
  Switch, Table, Tabs, TextArea, TextInput, Timeline, Toolbar, Tree,
  type PanelProps,
} from '@textui/widgets';
import { Spacer, useTheme, type BoxProps, type RenderOutput } from '@textui/core';

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
  subtitle?: string;
  rightTitle?: string;
  footer?: string;
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
        <Row gap={1}>
          <Checkbox label="Run migrations" checked />
          <Checkbox label="Notify the channel" indeterminate />
        </Row>
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
      <Column>
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
          <Badge label="failing" tone="danger" icon="!" />
          <Badge label="4.2.1" tone="info" />
        </Row>
        <Row gap={1}>
          <StatusDot status="up" label="api" />
          <StatusDot status="degraded" label="search" />
          <StatusDot status="down" label="mailer" />
          <StatusDot status="pending" label="worker" />
        </Row>
        <Row gap={1}>
          <Spinner label="draining" />
        </Row>
        <Row gap={1}>
          <Heading level={3}>A heading and labels</Heading>
        </Row>
        <Row gap={1}>
          <Label tone="muted">muted</Label>
          <Label tone="accent">accent</Label>
          <Label tone="danger">danger</Label>
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
        <Progress spacer value={72} total={100} label="upload" showValue />
        <Progress spacer value={31} total={100} label="index" tone="warning" showValue />
        <Gauge spacer value={86} label="disk" thresholds={[{ at: 80, tone: 'danger' }]} />
        <Gauge spacer value={12} label="quota" />
      </Column>
    ),
  },
  {
    id: 'charts',
    title: 'Charts',
    subtitle: 'a series in one row, or in a block',
    render: () => (
      <Column gap={1}>
        <Row>
          <Sparkline values={CPU} label="cpu" tone="warning" showValue />
          <Spacer />
          <Sparkline values={NET} label="net" tone="info" showValue />
        </Row>
        <AreaChart
          series={[{ values: CPU, label: 'cpu', tone: 'warning' }, { values: NET, label: 'net', tone: 'info' }]}
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
      <Row>
        <BarChart
          data={[
            { label: '2xx', value: 8421, tone: 'success' },
            { label: '3xx', value: 1180, tone: 'info' },
            { label: '4xx', value: 412, tone: 'warning' },
            { label: '5xx', value: 37, tone: 'danger' },
          ]}
        />
        <Spacer />
        <BarChart
          orientation="vertical"
          height={6}
          barWidth={2}
          data={[
            { label: 'Aa', value: 22, tone: 'success' },
            { label: 'Bb', value: 7, tone: 'info' },
            { label: 'Cc', value: 1, tone: 'danger' },
          ]}
        />
      </Row>
    ),
  },
  {
    id: 'grid',
    title: 'A heatmap',
    subtitle: 'a value per cell, one ramp',
    render: () => (
      <Heatmap
        data={[
          [1, 3, 6, 9, 7, 4],
          [2, 5, 8, 9, 6, 3],
          [0, 2, 4, 7, 5, 2],
        ]}
        rowLabels={['api', 'web', 'job']}
        columnLabels={['m', 't', 'w', 't', 'f', 's']}
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
    rightTitle: '(4) items',
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
    footer: 'a footer too, if you want one',
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
          { time: '09:14', title: 'Canary at 5%', description: 'error rate flat, check log file to see whats happening', tone: 'warning' },
          { time: '09:21', title: 'Rolled to 50%', tone: 'info' },
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
    id: 'table',
    title: 'A table',
    subtitle: 'columns that drop by priority',
    render: () => (
      <Column>
        <Row gap={1}>
          <Checkbox label="Filter row" />
          <Select
            label="Status"
            options={[
              { value: 'running', label: 'Running', description: 'All systems go' },
              { value: 'degraded', label: 'Degraded', description: 'Some issues' },
              { value: 'down', label: 'Down', description: 'Service unavailable' },
            ]}
            mode="floating"
            onChange={noop}
            border={undefined}
          />
        </Row>
        <Table
          focusable={false}
          responsive
          columns={[
            { key: 'name', header: 'Service', flex: true, priority: 3 },
            { key: 'region', header: 'Region', priority: 1 },
            { key: 'p99', header: 'p99', align: 'right', priority: 2 },
            {
              key: 'state',
              header: 'State',
              priority: 3,
              tone: (value) =>
                value === 'down' ? 'danger' : value === 'degraded' ? 'warning' : 'success',
            },
          ]}
          rows={[
            { id: '1', name: 'checkout', region: 'eu-west-1', p99: '120ms', state: 'live' },
            { id: '2', name: 'search', region: 'eu-west-1', p99: '480ms', state: 'degraded' },
            { id: '3', name: 'mailer', region: 'us-east-1', p99: '—', state: 'down' },
          ]}
        />
      </Column>
    ),
  },
  {
    id: 'code',
    title: 'Source',
    subtitle: 'highlighted, with a gutter',
    render: () => (
      <CodeViewer
        bg="surface"
        padding={[1, 0]}
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
    id: 'prose',
    title: 'Markdown',
    subtitle: 'headings, emphasis, a rule, a list',
    render: () => (
      <MarkdownView
        content={[
          '## Rollout',
          '',
          'Canaries go **first**, then the rest at `50%`.',
          '',
          '- watch the error rate',
          '- stop on a spike',
        ].join('\n')}
      />
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
  const theme = useTheme();
  const style: PanelProps = ['paper', 'paper-dark'].includes(theme.id) ? {
    bg: 'surfaceAlt',
    padding: {
      top: 1,
      right: 1,
      bottom: 1,
      left: 1,
    }
  } : {
    // bg: 'surfaceAlt',
    padding: {
      top: 1,
      right: 1,
      bottom: 0,
      left: 1,
    }
  };
  return (
    <Panel {...style} title={piece.title} subtitle={piece.subtitle} rightTitle={piece.rightTitle} footer={piece.footer} flex={1} {...rest}>
      {piece.render()}
    </Panel>
  );
}
