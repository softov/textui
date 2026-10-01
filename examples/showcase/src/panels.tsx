import {
  Alert, AreaChart, Badge, BarChart, Breadcrumb, Button, Checkbox, CodeViewer,
  Column, EmptyState, Gauge, Heading, KeyValue, Label, List, Pagination,
  Heatmap, MarkdownView, Panel, Progress, Row, ScrollView, Select, Skeleton, Slider, Sparkline,
  Spinner, StatusDot,
  Switch, Table, Tabs, TextArea, TextInput, Timeline, Toolbar, Tree,
  type PanelProps,
  Divider,
  Histogram,
  Center,
  Pattern,
  ColorText,
  banner,
  fontAt,
  inkGlyphs,
  Card,
  bannerLines,
} from '@textui/widgets';
import {
  Canvas, Spacer, Text, defineComponent, useCapabilities, useMeasure, useTheme,
  type BoxProps, type Color, type RenderOutput,
} from '@textui/core';

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

/**
 * Two fonts in one cell, and the two halves of block text.
 *
 * The shape comes from `FontText` and the colour from `ColorText`, which is
 * the split the two were made for - and this is the shortest thing that shows
 * both. `pagga` knocks its letters out of a shaded ground, `tmplt` draws them
 * in heavy box-drawing, and the second line carries the ink example's
 * `sunrise` ramp: `alignBlock` keeps its rows in step where per-line centring
 * would shear the letters, and `fit` breaks the sentence between its words
 * rather than through a letter, since it is wider than the cell it is in.
 */
// The other ramp, kept beside the one in use: the strip's `ink` swaps to it.
// const SUNRISE: Color[] = ['#ff5f6d', '#ffc371'];
const SPECTRUM: Color[] = ['#ff004d', '#ff8c00', '#ffe600', '#00d68f', '#00b7ff', '#a45cff'];
const BANNER_TEXT = 'Text Terminal User Interface';

const Banners = defineComponent('Banners', () => {
  const theme = useTheme();
  const capabilities = useCapabilities();
  const width = useMeasure().width;
  const ink = inkGlyphs(theme.glyphs, capabilities.unicode !== 'ascii');

  return (
    <Column>
      <Center padding={[1, 1, 0, 1]}>
        <ColorText
          content={banner("TextUI", fontAt('gard'), ink, width)}
          ink={{ gradient: SPECTRUM }}
          alignBlock
          wrap="none"
        />
      </Center>
      <Pattern
        tile={[
          '---o--'
        ]}
        ascii={[
          '---o--'
        ]}
        ink={{ gradient: SPECTRUM }}
        x={-1}
        y={-1}
        // fg="accent"
        height={1}
      />
      <Column padding={{top: 1}}>
        {bannerLines(BANNER_TEXT, fontAt('tmplt'), ink, width).map((line, i) => (
          <ColorText
            key={i}
            content={line}
            ink={{ cycle: SPECTRUM, every: 3 }}
            alignBlock
            textAlign="center"
            wrap="none"
          />
        ))}
      </Column>
      {/* <FontText
        content={BANNER_TEXT}
        font={fontAt('tmplt')}
        fg="success"
        wrap="word"
        lineGap={0}
      /> */}
    </Column>
  );
});

/** One entry in the grid. `id` is what `--only` names and what a test asserts. */
export interface Showpiece {
  id: string;
  title: string;
  /** What it is for, under the title. Kept short - it shares a line. */
  subtitle?: string;
  rightTitle?: string;
  footer?: string;
  /**
   * Draw no panel around this one - the content is the whole picture.
   *
   * For the pieces that are not a component in a frame: a banner, a texture, a
   * picture. `title` is still what `--only` and the caption call it.
   */
  isPure?: boolean;
  render(): RenderOutput;
}

const CPU = [12, 18, 15, 24, 33, 28, 41, 38, 52, 47, 61, 55, 48, 39, 44, 51];
const NET = [4, 9, 7, 14, 11, 22, 19, 31, 27, 24, 18, 21, 16, 12, 15, 13];

export const PANELS: Showpiece[] = [
  {
    id: 'textui',
    title: 'TextUI',
    isPure: true,
    render: () => <Banners />,
  },
  {
    id: 'controls',
    title: 'Controls',
    subtitle: 'every one of them takes keys',
    render: () => (
      <Column gap={1}>
        <Row gap={1}>
          <Button label="Deploy" tone="success" hint="↵" />
          <Button label="⎋ Cancel" hint="esc" />
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
        <Row gap={1} justify="between">
          <Badge label="live" tone="success" />
          <Badge label="canary" tone="warning" />
          <Badge label="failing" tone="danger" icon="!" />
          <Badge label="4.2.1" tone="info" />
          <Spinner label="draining" />
        </Row>
        <Row gap={1} justify="between">
          <StatusDot status="up" label="api" />
          <StatusDot status="degraded" label="search" />
          <StatusDot status="down" label="mailer" />
          <StatusDot status="pending" label="worker" />
        </Row>
        <Row gap={1}>
          <Heading level={3}>A heading and labels</Heading>
        </Row>
        <Row gap={1}>
          <Label tone="primary">primary</Label>
          <Label tone="success">success</Label>
          <Label tone="danger">danger</Label>
          <Label tone="info">info</Label>
          <Label tone="muted">muted</Label>
          <Label tone="warning">warning</Label>
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
        {/* <LineChart series={[
          { values: CPU, label: 'cpu' },
          { values: NET, label: 'net' }
        ]} chartHeight={6} /> */}
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
        <Center>
          <BarChart
            orientation="vertical"
            height={6}
            barWidth={2}
            data={[
              { label: 'A1', value: 14, tone: 'success' },
              { label: 'A2', value: 16, tone: 'success' },
              { label: 'A3', value: 7, tone: 'info' },
              { label: 'S1', value: 0, tone: 'muted' },
              { label: 'S2', value: 1, tone: 'danger' },
              { label: 'S3', value: 2, tone: 'warning' },
            ]}
          />
        </Center>
      </Row>
    ),
  },
  {
    id: 'grid',
    title: 'A heatmap',
    subtitle: 'a value per cell, one ramp',
    render: () => (
      <Row gap={1}>
        <Histogram values={[
          1,
          2, 2,
          3, 3, 3,
          4, 4,
          5,
          8,
          9, 9,
          10, 10, 10,
          11, 11,
          12
        ]} buckets={12} chartHeight={5} />
        <Center>
          <Heatmap
            data={[
              [1, 3, 6, 9, 7, 4, 1, 3, 6, 9, 7, 4],
              [2, 5, 8, 9, 6, 3, 1, 3, 6, 9, 7, 4],
              [0, 2, 4, 7, 5, 2, 1, 3, 6, 9, 7, 4],
            ]}
            rowLabels={['api', 'web', 'job']}
            columnLabels={['m', 't', 'w', 't', 'f', 's']}
          />
        </Center>
      </Row>
    ),
  },
  {
    id: 'facts',
    title: 'Facts',
    subtitle: 'label and value, aligned',
    render: () => (
      <>
        <KeyValue
          labelGap={2}
          items={[
            { label: 'image', value: 'checkout:4.2.1' },
            { label: 'uptime', value: '19d 4h' },
            { label: 'node', value: 'ip-10-0-3-14' },
          ]}
        />
        <Divider />
        <KeyValue
          valueAlign="right"
          items={[
            { label: 'restarts', value: '3', tone: 'warning' },
            { label: 'hosts', value: '9 / 12', tone: 'warning' },
            { label: 'replicas', value: '6 / 6', tone: 'success' },
          ]}
        />
      </>
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
        <Pagination page={3} pageCount={9} />
      </Column>
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
    id: 'code',
    title: 'Source',
    subtitle: 'highlighted, with a gutter',
    render: () => (
      <>

        <Toolbar
          items={[
            { id: 'new', label: 'New', shortcut: 'ctrl+n' },
            { id: 'run', label: 'Run', shortcut: 'f5', tone: 'success' },
            { id: 'stop', label: 'Stop', disabled: true },
          ]}
        />
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
      </>
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
    subtitle: 'headings, emphasis, and a scrollbar',
    render: () => (
      // A viewport rather than `maxLines`: the document is longer than the box
      // it was given, and the box says so with a bar and a thumb instead of
      // collapsing the rest into a count. `focusable` is the default, so the
      // arrows reach it once it is tabbed to.
      <ScrollView height={8} scrollbar>
        <MarkdownView
          content={[
            '## Rollout',
            '',
            'Canaries go **first**, then the rest at `50%`.',
            '',
            '- watch the error rate',
            '- stop on a spike',
            '',
            '### After the fact',
            '',
            'The rollout is complete when the last replica is ready. The canary',
            'is then retired rather than left at a low weight, so a slow burn',
            'does not turn into a permanent one.',
            '',
            '---',
            '',
            'Old revisions stay addressable for a week.',
          ].join('\n')}
        />
      </ScrollView>
    ),
  },
  {
    id: 'canvas',
    title: 'A Canvas',
    subtitle: 'cells painted by hand',
    render: () => (
      // The canvas primitive: no boxes, no text, one call per cell. Two
      // diagonals cross into a lattice, the theme's own block ramp grades it,
      // and the tones are palette tokens - so this is a pattern in the theme's
      // vocabulary rather than a picture pasted over it. Every glyph and every
      // colour resolves through `ctx`, which is what keeps it legible when the
      // terminal can only do ascii, or only do sixteen colours.
      <Canvas
        height={8}
        draw={(surface, ctx) => {
          const ramp = ctx.theme.glyphs.blocks;
          const period = 12;
          const half = period / 2;
          for (let y = 0; y < surface.rect.height; y++) {
            for (let x = 0; x < surface.rect.width; x++) {
              // How far this cell is from the nearest lattice line. The two
              // diagonals are `x + y` and `x - y`, which is what makes the
              // cells between them diamonds rather than squares.
              const a = (x + y) % period;
              const b = (((x - y) % period) + period) % period;
              const d = Math.min(a, period - a, b, period - b);
              // The lines are the tallest bar, the centres of the diamonds the
              // shortest, so the ramp reads as a weave.
              const level = Math.round((1 - d / half) * (ramp.length - 1));
              // A colour per diamond rather than per pixel: the two diagonals
              // together name which diamond a cell is in, so the pattern is an
              // argyle of four tones instead of a wash. `accent` and `info` (or
              // `primary`) are the same colour in several themes, so the four
              // are picked for being distinct in all of them.
              const diamond = Math.floor((x + y) / period) + Math.floor((x - y + period * 100) / period);
              const tone = ['accent', 'danger', 'success', 'warning'][
                ((diamond % 4) + 4) % 4
              ] as string;
              surface.put(x, y, ramp[level] as string, { fg: ctx.color(tone) });
            }
          }
        }}
      />
    ),
  },
  {
    id: 'pattern',
    title: 'A Pattern',
    // subtitle: 'a tile, repeated',
    render: () => (
      // The Pattern widget: one tile stamped across and down until the box runs
      // out, with `ascii` for a terminal that cannot draw the first one - a
      // component whose whole content is glyphs is the one that breaks worst
      // without it, and unlike a border there is no fallback the library could
      // guess for a tile it has never seen.
      <Pattern
        tile={[
          '\\/\\/\\/',
          '<> <> ',
          '/\\/\\/\\',
          '======',
          '<> <> ',
          '======',
        ]}
        ascii={[
          '\\/\\/\\/',
          '<> <> ',
          '/\\/\\/\\',
          '======',
          '<> <> ',
          '======',
        ]}
        x={-1}
        y={-1}
        fg="accent"
        height={9}
      >
        <Center>
          <Card title="A card" subtitle="pattern behind it" width={30} height={5}>
            <Text>Centered</Text>
          </Card>
        </Center>
      </Pattern>
    ),
  }
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
  // A pure piece is a cell like any other - one column of the grid - and the
  // only thing missing is the frame around it.
  if (piece.isPure === true) return <box flex={1} {...rest}>{piece.render()}</box>;
  // The paper themes, by the thing that makes them paper rather than by a list
  // of ids: `paper-light` was missing from that list, so the one light paper
  // picture was the one where the panels had no bottom row and no fill.
  const style: PanelProps = theme.density === 'airy' ? {
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
