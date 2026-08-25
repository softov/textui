// The worked example, and any prose, for each component's page.
//
// Written here rather than typed into 94 markdown files so a page can be
// created with its frontmatter, its generated prop table and its example in
// one pass. The generator writes a page only if it does not already exist -
// after that the markdown is the source of truth and this entry is history.
//
// Every `example` is extracted and typechecked by scripts/docs/extract-snippets.mjs.

export const EXAMPLES = {

  // ---- the four primitives ------------------------------------------------

  box: {
    summary: 'The container. Flex layout, background, border, title and footer - and the only primitive that holds children.',
    example: `<box direction="column" border="single" title="Services" padding={1} gap={1}>
  <text content="api" />
  <text content="worker" />
</box>`,
    notes: `A \`box\` is a flex container: \`direction\`, \`gap\`, \`padding\`, \`align\`,
\`justify\`, \`flex\` and the rest of [the style keys](../base-props.md) all
land here. \`title\` and \`footer\` are drawn *into* the border, so they need one
to land on - without a border they are dropped rather than drawn as rows.

Because every node takes \`role\`, \`label\` and \`onKey\`, a bare box is already
enough to build an interactive element:

\`\`\`tsx
<box role="button" label="Restart" focusable onClick={() => {}}>
  <text content="Restart" />
</box>
\`\`\`

That is a working, focusable, queryable button. [\`Button\`](../input/button.md)
exists because it also draws a ring, carries a tone and inverts when focused.`,
    seeAlso: `- [Row](../layout/row.md), [Column](../layout/column.md) - a box with its direction already set
- [Panel](../layout/panel.md) - a titled box that follows the theme
- [Base props](../base-props.md) - the style keys a box accepts`,
  },

  text: {
    summary: 'A run of text. Wraps, truncates and aligns within the box it is given.',
    example: `<text content="billing-worker" fg="accent" bold />`,
    notes: `\`content\` and children are the same thing - \`<text>hello</text>\` and
\`<text content="hello" />\` produce the same node. Prefer \`content\` when the
string is computed, because it survives being written as data.

Text does not size itself; the box around it decides the width, and \`wrap\` and
\`truncate\` decide what happens when the string is longer than that:

\`\`\`tsx
<box width={20}>
  <text content="a service name far too long for this column" truncate="middle" />
</box>
\`\`\`

\`truncate\` takes \`'start'\`, \`'middle'\`, \`'end'\` or \`false\`, and
\`ellipsis\` replaces the character used to mark the cut.`,
    seeAlso: `- [Heading](../display/heading.md), [Label](../display/label.md) - text with a role and a theme tone
- [Base props](../base-props.md) - \`wrap\`, \`textAlign\` and the other style keys`,
  },

  canvas: {
    summary: 'Direct cell painting. The escape hatch, and the only primitive the layout engine cannot reason about.',
    setup: `import type { PaintSurface, RenderContext } from '@textui/core';`,
    example: `<canvas
  intrinsic={{ height: 1 }}
  draw={(surface: PaintSurface, ctx: RenderContext) => {
    surface.fill(undefined, '\\u2500', { fg: ctx.color('muted') });
  }}
/>`,
    notes: `\`draw\` receives a [\`PaintSurface\`](https://github.com/softov/textui) clipped
to the node's own rectangle - \`put\`, \`text\`, \`fill\`, \`cell\` and \`clip\` -
and a render context carrying the resolved theme, the terminal's capabilities
and the node's focus state.

Reach for it only when the thing being drawn is not made of boxes and text.
Every chart in the catalog is a canvas; almost nothing else should be, because
a canvas is opaque to layout, to the test harness's semantic queries, and to
anything that wants to know what is on screen.

\`intrinsic\` is the size to take when the style does not fix one.`,
    seeAlso: `- [Sparkline](../display/sparkline.md), [Gauge](../display/gauge.md) - canvases worth reading before writing one
- [Writing a component](../writing.md) - composing \`box\` and \`text\` instead`,
  },

  spacer: {
    summary: 'Empty space. Greedy by default, or a fixed number of cells.',
    example: `<box direction="row">
  <text content="left" />
  <spacer />
  <text content="right" />
</box>`,
    notes: `Bare is the common case: with no \`size\` it takes whatever is left, which is
how two things end up at opposite ends of a row. \`size\` fixes it at a number
of cells instead, and \`flex\` is there when you want a share rather than all
of it.

\`Spacer\` is the same node under a Capitalized name, for a file written in one
case. There is no separate component - there was one, and the two differed only
in whether they were greedy, which is not a difference worth a second name.

A spacer is not the only way to get gaps. Between *every* child, \`gap\` on the
container is shorter and does not need a node per space.`,
    seeAlso: `- [Divider](../layout/divider.md) - space with a rule drawn through it
- [Row](../layout/row.md) - \`gap\`, for space between every child`,
  },

  // ---- layout -------------------------------------------------------------

  PathPicker: {
    summary: 'Pick a file or a folder by walking to it.',
    setup: `declare const open: (uri: string) => void;
declare const close: () => void;`,
    example: `import { PathPicker } from '@textui/widgets';

<PathPicker
  start="file:///home/you/project"
  wants="file"
  title="Open a file"
  onPick={(uri) => open(uri)}
  onCancel={() => close()}
/>`,
    notes: `The picker walks the **resource registry**, never the filesystem, so it browses
whatever is mounted rather than \`file:\` alone - the first thing anyone wants to
pick off a remote is a file.

Typing filters the visible rows. \`enter\` on a folder goes into it, and \`left\`
at the start of the filter goes back up: the field answers arrow keys itself, so
it hands the edges back through \`onEdge\` rather than swallowing them.

\`wants: 'directory'\` adds a "Use this folder" row, because when the answer is
the place you are standing there is no child to press enter on.

Most callers want [\`pick()\`](../../platform/layers.md) instead, which opens this
in a layer and returns a promise.`,
    seeAlso: `- [Menu](menu.md) - the list this is built on
- [CommandPalette](command-palette.md) - the same filter-and-choose shape, over commands`,
  },

  Row: {
    summary: 'A horizontal flex container.',
    example: `import { Row } from '@textui/widgets';

<Row gap={1} padding={1}>
  <text content="name" />
  <text content="status" />
</Row>`,
    notes: `\`Row\` is \`<box direction="row">\` with one difference worth knowing: it
centres its children on the cross axis by default, so a one-line label sits
level with a three-line panel beside it rather than at its top. \`vAlign\`
overrides that - \`'start'\`, \`'center'\`, \`'end'\` or \`'stretch'\`.

Sideways is the axis that shrinks. When a row does not fit, a child with
\`flex\` gives way first and a rigid one truncates its text; nothing is placed
outside the container.`,
    seeAlso: `- [Column](column.md) - the same thing, vertically
- [Grid](grid.md) - equal columns that wrap
- [Splitter](splitter.md) - two panes with a movable divide`,
  },

  Column: {
    summary: 'A vertical flex container.',
    example: `import { Column } from '@textui/widgets';

<Column gap={1} flex={1}>
  <text content="one" />
  <text content="two" />
</Column>`,
    notes: `Downwards is the axis that clips. Where a row narrows its children, a column
keeps their height and cuts the overflow - because a panel below the fold is
still readable and a panel with no bottom border is not.

Give exactly one child \`flex={1}\` to make it absorb the leftover height; that
is how a header, a body and a status bar divide a screen.`,
    seeAlso: `- [Row](row.md) - the same thing, horizontally
- [Stack](stack.md) - a column whose spacing comes from the theme
- [ScrollView](scroll-view.md) - when the content is taller than the space`,
  },

  Center: {
    summary: 'Centres its children on one axis or both.',
    example: `import { Center } from '@textui/widgets';

<Center flex={1}>
  <text content="nothing selected" fg="muted" />
</Center>`,
    notes: `\`axis\` takes \`'both'\` (the default), \`'horizontal'\` or \`'vertical'\`.

Centring needs room to centre in, so this is nearly always paired with
\`flex={1}\` or a fixed size. A \`Center\` that is exactly as big as its child
does nothing at all.`,
    seeAlso: `- [EmptyState](../display/empty-state.md) - the centred "nothing here" message, already written
- [Row](row.md), [Column](column.md) - \`align\` and \`justify\` for finer placement`,
  },

  Grid: {
    summary: 'Equal-width columns that wrap into rows.',
    example: `import { Grid } from '@textui/widgets';

<Grid columns={3} gap={1}>
  <text content="one" />
  <text content="two" />
  <text content="three" />
  <text content="four" />
</Grid>`,
    notes: `\`columns\` is required and fixed: this is not a responsive grid, and it will
not drop to fewer columns on a narrow terminal by itself. Change \`columns\`
from a [breakpoint](../base-props.md) or from measured width when that matters.

Every column is the same width. For columns that are not, use a
[Row](row.md) and give each child its own \`flex\` or \`width\`.`,
    seeAlso: `- [Row](row.md) - unequal columns
- [Table](../display/table.md) - columns with headers, priorities and rows`,
  },

  Panel: {
    summary: 'A titled region. Bordered or airy, whichever the theme asks for.',
    example: `import { Panel } from '@textui/widgets';

<Panel title="Services" meta="12" padding={1}>
  <text content="api" />
</Panel>`,
    notes: `\`Panel\` is the workhorse, and the one component that has to look right in all
three house styles. Where the theme draws borders it renders \`title\` into the
top rule; where the theme says \`border: 'none'\` it renders the title as a
heading row instead. \`meta\` goes to the right of the bottom rule, or of the
heading row.

A panel stretches to fill the row it is in. [\`Row\`](row.md) centres its
children by default, and a pane floating in the middle of a taller neighbour is
nobody's intent.

\`tone\` colours the border rather than the body, which is how a panel marks
itself as the errored or the active one without repainting its contents.`,
    seeAlso: `- [Card](../display/card.md) - the same idea without the frame
- [box](../primitives/box.md) - a panel with nothing decided for you
- [Themes](../../themes/) - what \`border: 'none'\` changes`,
  },

  Divider: {
    summary: 'A rule, optionally labelled.',
    example: `import { Divider } from '@textui/widgets';

<Divider label="Danger zone" />`,
    notes: `\`direction\` is \`'horizontal'\` by default; \`'vertical'\` draws a column rule
for splitting a row. \`char\` overrides the glyph, which matters on a terminal
that cannot draw box-drawing characters - though the theme already downgrades
that for you.

\`labelAlign\` takes \`'left'\` (the default), \`'center'\` or \`'right'\`.`,
    seeAlso: `- [Splitter](splitter.md) - a divider between two sized panes
- [spacer](../primitives/spacer.md) - the gap without the rule`,
  },


  Stack: {
    summary: 'A column whose spacing comes from the theme.',
    example: `import { Stack } from '@textui/widgets';

<Stack spacing="md">
  <text content="one" />
  <text content="two" />
</Stack>`,
    notes: `\`Stack\` is [\`Column\`](column.md) with \`gap\` taken from the theme's spacing
scale rather than from a number: \`'none'\`, \`'xs'\`, \`'sm'\`, \`'md'\`, \`'lg'\`,
\`'xl'\`.

Use it wherever the gap is "the usual one", so that changing the theme's
rhythm changes the screen. Use \`Column\` with an explicit \`gap\` where the
number is load-bearing and must not move.`,
    seeAlso: `- [Column](column.md) - an explicit gap
- [Themes](../../themes/tokens.md) - what the spacing scale resolves to`,
  },

  ScrollView: {
    summary: 'A scrolling viewport, with keyboard and wheel support.',
    example: `import { ScrollView } from '@textui/widgets';

<ScrollView flex={1}>
  <text content="a document taller than the space it was given" wrap="word" />
</ScrollView>`,
    notes: `Focusable by default, because a viewport nobody can put the keyboard into can
only be scrolled with a mouse. It draws a scrollbar unless told not to.

It knows nothing about what is inside it - it scrolls cells. That is the
difference between this and the data components: [\`List\`](../display/list.md)
scrolls by rows and keeps a selection,
[\`Feed\`](../display/feed.md) scrolls by measured entries, and a \`ScrollView\`
scrolls whatever it was handed.

Pass \`offset\` and \`onScroll\` to hold the position in the store rather than
inside the component, which is what lets a screen restore where the reader was.`,
    seeAlso: `- [List](../display/list.md), [Feed](../display/feed.md) - scrolling that understands its contents
- [CodeViewer](../display/code-viewer.md) - a viewport over lines, not cells`,
  },

  Splitter: {
    summary: 'Two panes with a divider between them.',
    example: `import { Splitter } from '@textui/widgets';

<Splitter direction="row" size="30%">
  <text content="sidebar" />
  <text content="main" />
</Splitter>`,
    notes: `Exactly two children. \`size\` applies to the first one and takes a number of
cells or a percentage; the second takes what is left. \`dividerSize\` is the
gap between them in cells.

\`direction\` is \`'row'\` for a vertical divide and \`'column'\` for a
horizontal one - it names the axis the children are laid along, matching
[\`Row\`](row.md) and [\`Column\`](column.md) rather than the direction the rule
is drawn.`,
    seeAlso: `- [SplitLayout](../surfaces/split-layout.md) - the same idea for surface mounts
- [Row](row.md) - more than two children, no divider`,
  },

  // ---- display ------------------------------------------------------------

  Heading: {
    summary: 'A section heading, sized and toned by the theme.',
    example: `import { Heading } from '@textui/widgets';

<Heading content="Services" level={1} />`,
    notes: `Three levels. What each one looks like is the theme's business - bold, a
colour, a rule underneath - and a terminal has no font sizes to fall back on,
so the difference between \`1\` and \`3\` is weight and colour rather than height.

\`Heading\` extends [\`TextProps\`](../base-props.md), so \`truncate\`,
\`textAlign\` and \`wrap\` all work.`,
    seeAlso: `- [Label](label.md) - a name for something, not a section
- [Panel](../layout/panel.md) - a titled region, which draws its own heading`,
  },

  Label: {
    summary: 'A short name for something, in one of the semantic tones.',
    example: `import { Label } from '@textui/widgets';

<Label content="CPU" tone="muted" />`,
    notes: `Use it for the name of a value rather than for prose. \`tone\` is the semantic
scale - \`muted\` for a field name, \`danger\` for one that has gone wrong - so
the colour survives a theme change and a downgrade to sixteen colours.

This is a display component and not the \`label\` *prop*, which every node
takes and which names a node for the test harness and for accessibility.`,
    seeAlso: `- [KeyValue](key-value.md) - label and value pairs, already aligned
- [Base props](../base-props.md) - the \`label\` prop, which is a different thing`,
  },

  Badge: {
    summary: 'A short inline tag - a count, a state, a version.',
    example: `import { Badge } from '@textui/widgets';

<Badge label="running" tone="success" />`,
    notes: `A badge is inline and stays one row, which is why its \`outline\` variant is
brackets rather than a box: a drawn frame would make it three rows and it would
stop sitting inside a line of text.

Otherwise it shares [\`Button\`](../input/button.md)'s vocabulary - the same
\`tone\` scale, the same \`variant\` names - because a reader should not have to
learn two.`,
    seeAlso: `- [StatusDot](status-dot.md) - a state as a glyph, which survives losing colour
- [Button](../input/button.md) - the same tones, but focusable`,
  },

  StatusDot: {
    summary: 'The shared status vocabulary: a glyph and a colour, never only a colour.',
    example: `import { StatusDot } from '@textui/widgets';

<StatusDot status="degraded" label="billing-worker" />`,
    notes: `Five states, and they are fixed: \`up\`, \`down\`, \`degraded\`, \`unknown\`,
\`pending\`. Fixing them is the point - a status that means the same thing
everywhere can be read at a glance, and one invented per screen cannot.

Each is **a glyph and a colour**, not a colour. A sixteen-colour session, a
colourblind reader and a piped log all lose the colour and keep the glyph, so
the glyph has to carry the meaning on its own.`,
    seeAlso: `- [Badge](badge.md) - free text rather than a fixed vocabulary
- [Alert](alert.md) - a state worth a whole row
- [Capabilities](../../terminal/capabilities.md) - what a 16-colour session loses`,
  },

  Card: {
    summary: 'A titled block with no frame, for grouping without drawing a box.',
    example: `import { Card } from '@textui/widgets';

<Card title="billing-worker" subtitle="eu-west-1" footer="updated 2m ago">
  <text content="42 jobs queued" />
</Card>`,
    notes: `Where [\`Panel\`](../layout/panel.md) draws a region, a card groups by spacing
and weight alone. Use a panel when the boundary matters - a pane you can focus,
resize or scroll - and a card when several of them sit in a
[\`Grid\`](../layout/grid.md) and a border each would be a cage.`,
    seeAlso: `- [Panel](../layout/panel.md) - the framed version
- [KeyValue](key-value.md) - for a card that is mostly field-and-value`,
  },

  KeyValue: {
    summary: 'Label and value pairs, aligned into one or more columns.',
    example: `import { KeyValue } from '@textui/widgets';

<KeyValue
  columns={2}
  items={[
    { label: 'Region', value: 'eu-west-1' },
    { label: 'Status', value: 'degraded', tone: 'warning' },
  ]}
/>`,
    notes: `Labels are aligned to a common width so the values line up; \`labelWidth\`
fixes that width when two blocks must agree and their longest labels do not.

Per-item \`tone\` colours the value, not the label - the field name is not the
thing that has gone wrong.`,
    seeAlso: `- [Table](table.md) - many records, one shape
- [Card](card.md) - a heading around a block of these`,
  },

  Timeline: {
    summary: 'Events in order, each with a time, a title and an optional note.',
    example: `import { Timeline } from '@textui/widgets';

<Timeline
  items={[
    { time: '09:02', title: 'Deploy started' },
    { time: '09:04', title: 'Health check failed', tone: 'danger', description: 'billing-worker' },
  ]}
/>`,
    notes: `Ordered top to bottom, in the order given - the component does not sort, since
"most recent first" and "oldest first" are both right depending on whether you
are reading history or watching it happen.

\`tone\` marks an entry, which is what separates the failed step from the four
that worked.`,
    seeAlso: `- [Feed](feed.md) - entries whose height is whatever their text wrapped to
- [LogViewer](log-viewer.md) - lines arriving continuously, with a tail`,
  },

  // ---- feedback and status ------------------------------------------------

  Alert: {
    summary: 'A message worth a row of its own, in one of four tones.',
    example: `import { Alert } from '@textui/widgets';

<Alert tone="warning" title="Degraded" message="Two of six workers are not responding." />`,
    notes: `Four tones only - \`info\`, \`success\`, \`warning\`, \`danger\` - rather than the
full semantic scale, because an alert that is \`muted\` or \`secondary\` is not
an alert.

\`title\` alone is a single line; adding \`message\` makes it a block. Children
are laid out below both, for an alert that needs an action in it.`,
    seeAlso: `- [ErrorState](error-state.md) - when the whole region failed, not one message
- [Toast](../navigation/toast.md) - a message that leaves on its own`,
  },

  Progress: {
    summary: 'A bar with its numbers stated.',
    example: `import { Progress } from '@textui/widgets';

<Progress label="Uploading" value={42} total={100} />`,
    notes: `\`total\` defaults to \`1\`, so a fraction works without arithmetic:
\`value={0.42}\` and \`value={42} total={100}\` draw the same bar.

\`showValue\` is on by default, and turning it off is usually wrong - a bar
with no number is a shape, and a reader cannot tell 80% from 85% by looking at
eight cells.

Omitting \`value\` gives an indeterminate bar, for work whose size is not known
yet.`,
    seeAlso: `- [Spinner](spinner.md) - work with no measurable progress at all
- [Gauge](gauge.md) - a level rather than a task`,
  },

  Spinner: {
    summary: 'Work in progress, with no measurable amount of it.',
    example: `import { Spinner } from '@textui/widgets';

<Spinner label="Connecting" />`,
    notes: `Use it only when the duration is genuinely unknown. Anything with a numerator
and a denominator should be a [\`Progress\`](progress.md), because a spinner
tells a reader nothing except that the program has not died.

The frames come from the theme's glyph set and degrade to ASCII where the
terminal cannot draw them.`,
    seeAlso: `- [Progress](progress.md) - when the size is known
- [Skeleton](skeleton.md) - when the shape of what is coming is known`,
  },

  Skeleton: {
    summary: 'The shape of content that has not arrived yet.',
    example: `import { Skeleton } from '@textui/widgets';

<Skeleton lines={3} widths={[100, 80, 60]} />`,
    notes: `\`widths\` are percentages, and varying them is the whole trick: three identical
bars read as a bar chart, while three ragged ones read as a paragraph.

Worth it when the layout is known and the data is not, so that arriving content
does not shift the screen. Not worth it for anything that usually resolves in
one frame.`,
    seeAlso: `- [Spinner](spinner.md) - when the shape is not known either
- [EmptyState](empty-state.md) - when nothing is coming`,
  },

  EmptyState: {
    summary: 'Nothing here, and what to do about it.',
    example: `import { EmptyState } from '@textui/widgets';

<EmptyState
  title="No services"
  message="Nothing is registered in this namespace yet."
  hint="press n to add one"
/>`,
    notes: `\`hint\` is the part that earns the component. An empty list that says only
"No services" leaves the reader stuck; one that names the key out is the
difference between an empty state and a dead end.

Centre it with [\`Center\`](../layout/center.md) if it is standing in for a
whole pane.`,
    seeAlso: `- [ErrorState](error-state.md) - empty because something broke
- [Center](../layout/center.md) - for filling the region it replaces`,
  },

  ErrorState: {
    summary: 'Something threw, and here is what and whether to retry.',
    example: `import { ErrorState } from '@textui/widgets';

<ErrorState error={new Error('connection refused')} onRetry={() => {}} />`,
    notes: `\`error\` is \`unknown\` on purpose: what a \`catch\` gives you is not always an
\`Error\`, and a component that demanded one would push a type assertion into
every call site. It renders what it can from whatever it is handed.

\`onRetry\` draws a retry button when given and nothing when not, so a failure
with no recovery does not offer one.

This is also what a component boundary renders when a subtree throws - see
[When one throws](../errors.md).`,
    seeAlso: `- [When one throws](../errors.md) - fallbacks and boundaries
- [Alert](alert.md) - a warning that is not a failed region
- [EmptyState](empty-state.md) - nothing to show, but nothing wrong`,
  },

  // ---- data ---------------------------------------------------------------

  List: {
    summary: 'Fixed-height rows with a selection and a keyboard.',
    example: `import { List } from '@textui/widgets';

<List
  items={[
    { id: 'api', label: 'api', meta: 'healthy' },
    { id: 'worker', label: 'billing-worker', meta: 'degraded', tone: 'warning' },
  ]}
  selectedId="api"
  onSelect={(id) => console.log(id)}
/>`,
    notes: `\`onSelect\` fires as the cursor moves; \`onActivate\` fires on enter. Keeping
them apart is what lets a list drive a preview pane without opening something
on every arrow key.

Hold \`selectedId\` in the store rather than inside the list when anything else
needs to know what is selected - which is usually.

How much it draws is decided by the props you pass, not by \`visibleRows\`:
given \`flex\`, a \`height\` or a \`maxHeight\` it renders what fits and scrolls;
given none of those it renders everything and grows. See
[how much these draw](../display.md).`,
    seeAlso: `- [Table](table.md) - rows with columns
- [Tree](tree.md) - rows that nest
- [Feed](feed.md) - rows whose height is whatever their text wrapped to`,
  },

  Table: {
    summary: 'Columns with headers, responsive by dropping the least important.',
    example: `import { Table } from '@textui/widgets';

<Table
  columns={[
    { key: 'name', header: 'NAME', width: 18 },
    { key: 'status', header: 'STATUS', width: 10, priority: 90 },
    { key: 'cpu', header: 'CPU', width: 7, align: 'right', priority: 40 },
  ]}
  rows={[{ name: 'api', status: 'healthy', cpu: '2%' }]}
  rowKey="name"
/>`,
    notes: `Narrowing **drops columns rather than squeezing them**. As the space runs out
the lowest \`priority\` goes first, and the first column never goes at all -
a row you cannot identify is not a smaller row, it is a useless one.

A column with no stated priority inherits its position, so it never ties with
one explicitly marked unimportant. Set \`responsive={false}\` to turn the whole
behaviour off.

\`format\` renders a cell and \`tone\` colours it, both from the value and the
whole row - which is how a latency column goes red past a threshold without
the rows carrying presentation.`,
    seeAlso: `- [List](list.md) - one column, with a selection
- [Pagination](pagination.md) - for when the rows do not all arrive at once
- [KeyValue](key-value.md) - one record rather than many`,
  },

  Tree: {
    summary: 'Rows that nest, expand and collapse.',
    example: `import { Tree } from '@textui/widgets';

<Tree
  nodes={[
    { id: 'src', label: 'src', children: [{ id: 'app', label: 'app.tsx' }] },
  ]}
  expandedIds={['src']}
  onToggle={(id, expanded) => console.log(id, expanded)}
/>`,
    notes: `\`expandedIds\` is a controlled list, so what is open lives wherever you keep
it and survives the tree being unmounted. \`hasChildren\` marks a node as
expandable before its children are known, which is what a lazily-loaded
directory needs to draw an arrow at all.

\`indent\` is in cells per level, and two is usually right in a terminal - four
runs out of width three levels down.`,
    seeAlso: `- [List](list.md) - the flat version
- [ResourceExplorer](../surfaces/resource-explorer.md) - a tree over a resource provider`,
  },

  Pagination: {
    summary: 'Page N of M, with the keys to move between them.',
    example: `import { Pagination } from '@textui/widgets';

<Pagination page={2} pageCount={9} total={412} onChange={(page) => console.log(page)} />`,
    notes: `\`page\` is 1-based. \`total\` is the row count rather than the page count, and
is optional - it is there so the control can say "412 items" instead of only
"2 / 9".

Pagination is a control, not a data source: it reports where the reader wants
to be and something else fetches it.`,
    seeAlso: `- [Table](table.md) - what usually sits above it
- [Store](../../store/) - where the current page belongs`,
  },

  LogViewer: {
    summary: 'Lines arriving continuously, with a tail that stops when you scroll.',
    example: `import { LogViewer } from '@textui/widgets';

<LogViewer
  lines={[
    { time: '09:02:11', level: 'info', message: 'listening on :8080' },
    { time: '09:02:14', level: 'error', source: 'db', message: 'connection refused' },
  ]}
  flex={1}
/>`,
    notes: `It follows the tail until the reader scrolls, then stops. That single
behaviour is the difference between a log you can read and one that yanks
itself away the moment you find something.

\`follow\` and \`onFollowChange\` expose that state, so a status bar can say
"following" and a key can turn it back on. Turn \`showTime\` or \`showLevel\`
off when the lines already carry their own.`,
    seeAlso: `- [Feed](feed.md) - entries rather than lines, with a cursor
- [CodeViewer](code-viewer.md) - a fixed document rather than a stream`,
  },

  CodeViewer: {
    summary: 'A viewport over source, highlighted by the registry and scrolled by lines.',
    example: `import { CodeViewer } from '@textui/widgets';

<CodeViewer content={'const x = 1;\\nconst y = 2;\\n'} language="ts" flex={1} />`,
    notes: `A viewport, not a column of lines: it renders the rows it was laid out into,
slices each one to the visible columns rather than claiming the width of the
longest, and expands tabs to real tab stops. **Opening a ten-thousand-line file
costs what opening a ten-line one costs.**

Colour comes from asking the highlighter registry what opens the \`kind\` it was
given; pass \`tokens\` directly to bypass that and highlight it yourself.

\`line\` and \`onLineChange\` hold the cursor, and \`onPosition\` reports line and
column together for a status bar.`,
    seeAlso: `- [Syntax highlighting](../../themes/syntax.md) - what the registry resolves
- [CodeEditor](../surfaces/code-editor.md) - the same viewport, writable
- [ScrollView](../layout/scroll-view.md) - scrolling cells rather than lines`,
  },

  MarkdownView: {
    summary: 'Markdown laid out into the width it was given. Does not scroll.',
    example: `import { MarkdownView } from '@textui/widgets';

<MarkdownView content={'# Title\\n\\nSome **bold** text.\\n'} />`,
    notes: `It deliberately owns no viewport. A document viewer scrolls; a message inside a
transcript does not, and making this scroll would put a second scrollable thing
inside the first.

Two ways to drive it. Pass \`content\` and it lays out what it measured. Pass
\`rows\` from \`layoutMarkdown\` plus a \`window\` and it paints that slice of
somebody else's layout - which is exactly what
[\`MarkdownViewer\`](../surfaces/markdown-viewer.md) does with it.

Inline emphasis, code and links survive the wrap, because in text a service or
an agent wrote for a person those are meaning rather than markup.`,
    seeAlso: `- [MarkdownViewer](../surfaces/markdown-viewer.md) - the scrolling document viewer
- [Feed](feed.md) - what usually holds a stack of these`,
  },

  Feed: {
    summary: 'Entries whose height is whatever their text wrapped to, with a cursor and a tail.',
    example: `import { Feed } from '@textui/widgets';

<Feed flex={1} follow>
  <text content="a first entry" wrap="word" />
  <text content="a second, longer entry that will wrap" wrap="word" />
</Feed>`,
    notes: `The one between [\`List\`](list.md) and
[\`ScrollView\`](../layout/scroll-view.md), and it is neither: a list is
fixed-height rows with a selection, a scroll view is a viewport that knows
nothing about its contents, and a feed is entries of unequal height with a
cursor that moves between them.

A transcript, an activity stream, search results with snippets, and a diff
whose files expand are all this component.

Its heights are **measured, not computed**. What a paragraph wraps to is
decided by the layout, so each entry reports its height once laid out and the
feed scrolls by summing them. That is one frame behind, which is invisible, and
it is the only answer that is not a guess.`,
    seeAlso: `- [List](list.md) - when every row is the same height
- [LogViewer](log-viewer.md) - when entries are single lines
- [ScrollView](../layout/scroll-view.md) - when there is nothing to put a cursor on`,
  },

  // ---- charts -------------------------------------------------------------

  Sparkline: {
    summary: 'A trend in one row, drawn with eight block levels.',
    example: `import { Sparkline } from '@textui/widgets';

<Sparkline values={[3, 5, 4, 8, 6, 9]} showValue />`,
    notes: `One row, so it fits in a table cell or beside a label. A cell has one level of
resolution, so the shape is drawn from the eight block glyphs rather than
pretending at pixels.

\`showValue\` prints the last value after the line, and is worth turning on: a
shape with no scale is decoration.`,
    seeAlso: `- [LineChart](line-chart.md) - when the shape needs an axis
- [Progress](progress.md) - one value rather than a series`,
  },

  BarChart: {
    summary: 'Labelled bars, horizontal or vertical.',
    example: `import { BarChart } from '@textui/widgets';

<BarChart
  data={[
    { label: 'api', value: 42 },
    { label: 'worker', value: 17, tone: 'warning' },
  ]}
/>`,
    notes: `Horizontal by default, which is the right way round in a terminal: labels read
left to right and a vertical bar chart has nowhere to put them.

Per-bar \`tone\` marks one out. \`max\` fixes the scale so two charts can be
compared - without it each scales to its own largest value and the taller bar
means nothing.`,
    seeAlso: `- [Histogram](histogram.md) - buckets computed from raw values
- [Heatmap](heatmap.md) - two dimensions rather than one`,
  },

  LineChart: {
    summary: 'One or more series on a braille grid, with axes.',
    example: `import { LineChart } from '@textui/widgets';

<LineChart
  series={[{ label: 'p95', values: [12, 18, 15, 22, 19] }]}
  chartHeight={8}
/>`,
    notes: `Plotted on a 2×4 braille grid, so a 40×8 chart really has 80×32 plot
positions. Where braille is unavailable it falls back to block levels and still
reads.

Several \`series\` overlay on shared axes; each carries its own \`label\` and
\`tone\`. \`min\` and \`max\` fix the scale, which matters whenever two charts sit
side by side.`,
    seeAlso: `- [AreaChart](area-chart.md) - the same chart, filled
- [Sparkline](sparkline.md) - when one row is enough
- [Capabilities](../../terminal/capabilities.md) - what happens without braille`,
  },

  AreaChart: {
    summary: 'A line chart with the area under it filled.',
    example: `import { AreaChart } from '@textui/widgets';

<AreaChart series={[{ label: 'requests', values: [4, 9, 6, 12, 11] }]} />`,
    notes: `Identical to [\`LineChart\`](line-chart.md) but with \`area\` on - it takes the
same props and is the same component underneath.

Filling reads as volume, which is right for a quantity accumulating and wrong
for a rate that can fall - a filled dip looks like a hole rather than a lower
number.`,
    seeAlso: `- [LineChart](line-chart.md) - unfilled, and the full prop list
- [Histogram](histogram.md) - a distribution rather than a series`,
  },

  Histogram: {
    summary: 'A distribution, bucketed from raw values.',
    example: `import { Histogram } from '@textui/widgets';

<Histogram values={[2, 3, 3, 4, 7, 8, 8, 9]} buckets={8} />`,
    notes: `Give it the raw values, not counts - the bucketing is the component's job, and
doing it outside means two places decide what a bucket is.

\`buckets\` defaults to twelve. Fewer than the chart is wide wastes the space;
more than that cannot be drawn.`,
    seeAlso: `- [BarChart](bar-chart.md) - when the categories are already decided
- [Heatmap](heatmap.md) - a distribution over two axes`,
  },

  Gauge: {
    summary: 'One value against a range, with thresholds.',
    example: `import { Gauge } from '@textui/widgets';

<Gauge
  value={82}
  label="Disk"
  thresholds={[{ at: 75, tone: 'warning' }, { at: 90, tone: 'danger' }]}
/>`,
    notes: `\`thresholds\` are what makes this different from a
[\`Progress\`](progress.md) bar: the gauge recolours itself as the value crosses
each one, so "how full" and "is that bad" are one glance instead of two.

They are read in order, so list them ascending. \`min\` and \`max\` default to 0
and 100.`,
    seeAlso: `- [Progress](progress.md) - a task completing rather than a level
- [StatusDot](status-dot.md) - the state without the number`,
  },

  Heatmap: {
    summary: 'A grid of values, coloured by intensity.',
    example: `import { Heatmap } from '@textui/widgets';

<Heatmap
  data={[[1, 4, 9], [3, 3, 2]]}
  rowLabels={['api', 'worker']}
  columnLabels={['mon', 'tue', 'wed']}
/>`,
    notes: `\`data\` is rows of columns. \`ramp\` overrides the glyphs used for intensity,
which is the escape hatch for a terminal or a palette where the default does
not separate cleanly.

The usual warning applies harder here than anywhere else in the catalog: on a
sixteen-colour session the ramp has very little to work with, so the default
varies glyph as well as colour.`,
    seeAlso: `- [Histogram](histogram.md) - one axis
- [Glyphs, borders and colour depth](../../themes/downgrade.md) - what degrades`,
  },

  // ---- controls -----------------------------------------------------------

  Checkbox: {
    summary: 'An independent on/off, with a third indeterminate state.',
    example: `import { Checkbox } from '@textui/widgets';

<Checkbox label="Notify on failure" checked onChange={(checked) => console.log(checked)} />`,
    notes: `Space toggles it. \`indeterminate\` is the "some of the children" state for a
parent checkbox; it is a display state only, and the next toggle resolves to
checked.

Use a checkbox when the options are independent. When exactly one of several
must be chosen, that is a [\`RadioGroup\`](radio-group.md), and when the thing
takes effect immediately rather than on submit it reads better as a
[\`Switch\`](switch.md).`,
    seeAlso: `- [Switch](switch.md) - the same boolean, different promise
- [RadioGroup](radio-group.md) - one of several
- [Field](field.md) - wrapping it in a form`,
  },

  Switch: {
    summary: 'A boolean that takes effect as soon as it moves.',
    example: `import { Switch } from '@textui/widgets';

<Switch label="Follow tail" value onChange={(value) => console.log(value)} />`,
    notes: `The difference from [\`Checkbox\`](checkbox.md) is a promise to the reader, not
a shape: a switch means the change has already happened, a checkbox means it
will happen when the form is submitted. Putting a switch in a form with a
Submit button breaks that promise.

\`labels\` renames the two states from \`['off', 'on']\`, for a control whose
states have names of their own.`,
    seeAlso: `- [Checkbox](checkbox.md) - when submission is what applies it
- [Button](button.md) - when it is an action rather than a state`,
  },

  RadioGroup: {
    summary: 'Exactly one of several options.',
    example: `import { RadioGroup } from '@textui/widgets';

<RadioGroup
  label="Theme"
  options={[
    { value: 'plain', label: 'Plain' },
    { value: 'console', label: 'Console' },
  ]}
  value="plain"
  onChange={(value) => console.log(value)}
/>`,
    notes: `The whole group is one stop in the tab order and the arrow keys move within
it, which is what a group of radios is supposed to do and what a row of
checkboxes cannot.

\`inline\` lays them along a row. Past about four options a
[\`Select\`](select.md) costs one row instead of four and is easier to scan.`,
    seeAlso: `- [Select](select.md) - the same choice, collapsed
- [Checkbox](checkbox.md) - when more than one may be true`,
  },

  Slider: {
    summary: 'A number in a range, moved with the arrow keys.',
    example: `import { Slider } from '@textui/widgets';

<Slider label="Volume" value={40} onChange={(value) => console.log(value)} />`,
    notes: `Left and right move by \`step\`. \`format\` renders the number beside the track,
which is where a unit goes - \`\${value}ms\` reads and \`420\` does not.

A terminal slider is coarse: \`trackWidth\` cells for the whole range, so 20
cells over 0-100 moves in visible jumps of five. Where the exact number matters
more than the sense of a range, a [\`TextInput\`](text-input.md) is honest and a
slider is not.`,
    seeAlso: `- [Progress](../display/progress.md) - reporting a value rather than setting one
- [TextInput](text-input.md) - when the precise number matters`,
  },

  TextInput: {
    summary: 'A single line of text, with a real terminal cursor.',
    example: `import { TextInput } from '@textui/widgets';

<TextInput label="Name" value="" onChange={(value) => console.log(value)} />`,
    notes: `It publishes a **real cursor position** when the terminal has a cursor, so the
caret is where typing lands rather than a drawn approximation. That means
counting the label and any glyph before it, and scrolling the value sideways to
keep the caret in view on a field narrower than its contents.

\`hideLabel\` keeps the label as the field's accessible name without drawing it,
for a form or a dialog that already shows it.

\`focusId\` is worth setting. Without one the focus id is derived from the
instance, which nothing outside the render can know - so a command meaning
"focus the filter" has nothing to name.`,
    seeAlso: `- [TextArea](text-area.md) - more than one line
- [SearchBox](search-box.md) - the same field with a glyph and a count
- [Field](field.md) - label, hint and validation around it`,
  },

  TextArea: {
    summary: 'A paragraph: grows to what has been typed, then scrolls.',
    example: `import { TextArea } from '@textui/widgets';

<TextArea value="" onChange={(value) => console.log(value)} maxRows={6} />`,
    notes: `A newline is \`alt+enter\` or \`ctrl+j\` - **never \`shift+enter\`**, which most
terminals cannot tell apart from plain \`enter\`. Passing \`onSubmit\` is what
makes enter mean "done"; without it enter is a newline like any other key.

It also settles the question a single-letter keybinding raises. The focused
node is offered a key *before* any keybinding, so while a text field has the
keyboard, \`q\` is a letter. That is what lets an application with a composer in
it keep \`n\`, \`r\` and \`d\` as commands - and why a global \`q\` for quit only
works where nothing happens to be reading it.

\`onOverflow\` fires when the cursor tries to leave the top or the bottom,
which is how a composer inside a list hands focus back.`,
    seeAlso: `- [TextInput](text-input.md) - one line, and enter submits
- [Keybindings](../../platform/keybindings.md) - why the focused node wins`,
  },

  Select: {
    summary: 'One of several, collapsed into a row until opened.',
    example: `import { Select } from '@textui/widgets';

<Select
  label="Region"
  options={[
    { value: 'eu-west-1', label: 'eu-west-1' },
    { value: 'us-east-1', label: 'us-east-1' },
  ]}
  value="eu-west-1"
  onChange={(value) => console.log(value)}
/>`,
    notes: `Closed it is one row; open it is a panel on the floating
[layer](../../platform/layers.md), so it draws over what is beneath it instead
of pushing the form down.

\`open\` makes that controlled, for a screen that wants to open the list from a
command. \`visibleRows\` caps the panel and the rest scrolls.`,
    seeAlso: `- [RadioGroup](radio-group.md) - when there are few enough to show at once
- [CommandPalette](../navigation/command-palette.md) - searching commands rather than choosing a value`,
  },

  SearchBox: {
    summary: 'A text input with a search glyph and a result count.',
    example: `import { SearchBox } from '@textui/widgets';

<SearchBox value="" count={12} onChange={(value) => console.log(value)} />`,
    notes: `Everything [\`TextInput\`](text-input.md) takes except \`search\`, which is
already on. \`count\` prints the number of matches in the field, which is the
one piece of feedback a filter needs and the one most often left to a label
somewhere else.

Filtering is not its job. It reports what was typed; what that matches is the
screen's business.`,
    seeAlso: `- [TextInput](text-input.md) - the full prop list
- [List](../display/list.md), [Table](../display/table.md) - what a search box usually filters`,
  },

  // ---- forms --------------------------------------------------------------

  Form: {
    summary: 'The context a set of fields share - values, errors and submission.',
    setup: `declare const save: (values: unknown) => void;`,
    example: `import { Field, Form, TextInput, useForm } from '@textui/widgets';

export function Profile() {
  const form = useForm({
    initialValues: { name: '' },
    onSubmit: (values) => save(values),
  });

  return (
    <Form form={form}>
      <Field name="name" label="Name">
        <TextInput value={String(form.values.name)} onChange={(v) => form.setValue('name', v)} />
      </Field>
    </Form>
  );
}`,
    notes: `\`Form\` carries the \`FormApi\` from \`useForm\` down to the
[\`Field\`](field.md)s inside it, so a field can find its own error and touched
state by name.

Validation runs over the **whole values object** rather than per field, because
the rules people actually need are cross-field - a confirmation that must match
a password, a date that must follow another date. Errors show after a field is
touched, or after a submit attempt.`,
    seeAlso: `- [Field](field.md) - one labelled input inside it
- [FormActions](form-actions.md) - the submit row
- [Controls and forms](../input.md) - \`validators\` and \`fieldValidators\``,
  },

  Field: {
    summary: 'A label, a control, a hint and whatever error the form has for it.',
    example: `import { Field, TextInput } from '@textui/widgets';

<Field name="email" label="Email" hint="We only use this for alerts" required>
  <TextInput value="" onChange={() => {}} />
</Field>`,
    notes: `\`name\` is how it finds its error in the surrounding [\`Form\`](form.md), so it
must match the key in \`initialValues\`. Outside a form a field is just a
labelled row, which is fine.

\`labelWidth\` aligns labels across fields that are not siblings. \`stacked\`
puts the label above the control instead of beside it, which is what a narrow
terminal wants.`,
    seeAlso: `- [Form](form.md) - the context it reads from
- [TextInput](text-input.md), [Select](select.md) - what usually goes inside`,
  },

  FormSection: {
    summary: 'A titled group of fields.',
    example: `import { FormSection } from '@textui/widgets';

<FormSection title="Notifications" description="Where alerts are sent.">
  <text content="fields go here" />
</FormSection>`,
    notes: `Grouping only - it holds no form state and does not need to be inside a
[\`Form\`](form.md).

Worth reaching for once a form is long enough that a reader scrolls it. Below
about six fields it adds a heading to something that did not need one.`,
    seeAlso: `- [Field](field.md) - the rows inside it
- [Panel](../layout/panel.md) - when the group wants a frame`,
  },

  FormActions: {
    summary: 'The submit and cancel row, already laid out.',
    example: `import { FormActions } from '@textui/widgets';

<FormActions submitLabel="Save" onCancel={() => {}} />`,
    notes: `Inside a [\`Form\`](form.md) it wires itself to the form's submit and disables
the button while the form is invalid or submitting - which is why the initial
values are validated immediately, so \`form.valid\` is usable from the first
frame rather than only after a keystroke.

\`requireDirty\` additionally disables submit until something has changed, for a
settings screen where saving an unedited form is a pointless write.`,
    seeAlso: `- [Form](form.md) - what it submits
- [Button](button.md) - for an action that is not a form submission`,
  },

  DangerZone: {
    summary: 'A destructive action, fenced off and optionally typed to confirm.',
    example: `import { DangerZone } from '@textui/widgets';

<DangerZone
  description="Deletes the namespace and everything in it."
  actionLabel="Delete namespace"
  confirmText="billing"
  onAction={() => {}}
/>`,
    notes: `\`confirmText\` is the part worth using: the action stays disabled until the
reader types that exact string. For anything irreversible that is a better
guard than a confirmation dialog, which people dismiss by reflex.

Put it last. A destructive action among ordinary fields is one mis-aimed
keystroke from happening.`,
    seeAlso: `- [Dialog](../navigation/dialog.md) - confirming something less final
- [FormActions](form-actions.md) - the ordinary submit row`,
  },

  // ---- navigation ---------------------------------------------------------

  Tabs: {
    summary: 'One of several views, chosen from a row of labels.',
    example: `import { Tabs } from '@textui/widgets';

<Tabs
  items={[
    { id: 'logs', label: 'Logs' },
    { id: 'metrics', label: 'Metrics', badge: 3 },
  ]}
  activeId="logs"
  onChange={(id) => console.log(id)}
/>`,
    notes: `Tabs draw the strip and report the choice; they do not hold the panels. What
is below them is the screen's business, which is what lets the same strip drive
a surface, a router or a plain conditional.

For panels that are *mounts* rather than markup, the surface system already
has this: [\`TabsLayout\`](../surfaces/tabs-layout.md) arranges a surface's
mounts as tabs and needs no strip of your own.

\`badge\` puts a count on a tab, which is the usual reason a reader looks at one
they were not already on.`,
    seeAlso: `- [TabsLayout](../surfaces/tabs-layout.md) - the same idea over surface mounts
- [Breadcrumb](breadcrumb.md) - depth rather than siblings`,
  },

  Breadcrumb: {
    summary: 'Where you are, and every level you can go back to.',
    example: `import { Breadcrumb } from '@textui/widgets';

<Breadcrumb
  items={[
    { id: 'root', label: 'services' },
    { id: 'api', label: 'api' },
  ]}
  onSelect={(id) => console.log(id)}
/>`,
    notes: `\`maxItems\` collapses the middle when the trail is longer than the width -
first and last survive, since those are the two a reader actually uses.

The last item is where you are and is not selectable. \`onSelect\` fires for the
others.`,
    seeAlso: `- [ResourceBreadcrumb](../surfaces/resource-breadcrumb.md) - the same trail from a resource URI
- [Tabs](tabs.md) - siblings rather than ancestors`,
  },

  Menu: {
    summary: 'A list of commands, with shortcuts and submenus.',
    example: `import { Menu } from '@textui/widgets';

<Menu
  items={[
    { id: 'open', label: 'Open', shortcut: 'ctrl+o' },
    { id: 'save', label: 'Save', shortcut: 'ctrl+s', separatorBefore: true },
  ]}
  onSelect={(id) => console.log(id)}
/>`,
    notes: `\`shortcut\` draws the chord; it does not register it. The keybinding is still
[\`app.keybindings.register\`](../../platform/keybindings.md), and the menu is
saying out loud what the chord already does.

\`separatorBefore\` puts a rule above an item, which is how a destructive action
gets separated from the ones above it. \`children\` nests a submenu.

\`interactive={false}\` renders it as a static list - for a cheat sheet or a
help pane rather than a menu.`,
    seeAlso: `- [CommandPalette](command-palette.md) - searching the command registry instead
- [Toolbar](toolbar.md) - the same actions along a row
- [Commands](../../platform/commands.md) - what the ids should refer to`,
  },

  StatusBar: {
    summary: 'The bottom line: segments at the left, segments at the right.',
    example: `import { StatusBar } from '@textui/widgets';

<StatusBar
  leading={[{ id: 'branch', label: 'main' }]}
  trailing={[{ id: 'pos', label: '12:4' }]}
/>`,
    notes: `\`leading\` and \`trailing\` rather than \`left\` and \`right\`, so the component
still reads correctly under a right-to-left locale.

Each segment carries its own \`tone\`, which is how one indicator goes red
without the bar changing colour.`,
    seeAlso: `- [KeyHints](key-hints.md) - the other thing that usually lives on this line
- [BarLayout](../surfaces/bar-layout.md) - a surface arranged as a bar`,
  },

  Toolbar: {
    summary: 'Actions along a row, with optional shortcuts.',
    example: `import { Toolbar } from '@textui/widgets';

<Toolbar
  items={[
    { id: 'run', label: 'Run', shortcut: 'ctrl+r' },
    { id: 'stop', label: 'Stop', disabled: true },
  ]}
  onSelect={(id) => console.log(id)}
/>`,
    notes: `Like [\`Menu\`](menu.md), \`shortcut\` is drawn and not registered.

A toolbar is horizontal and space is scarce, so the ids should be
[commands](../../platform/commands.md) - the same action then reaches the
palette and a chord without a second implementation.`,
    seeAlso: `- [Menu](menu.md) - the same actions, vertically, with submenus
- [Button](../input/button.md) - one action rather than a set`,
  },

  KeyHints: {
    summary: 'The keys available right now, along one line.',
    example: `import { KeyHints } from '@textui/widgets';

<KeyHints hints={[{ keys: 'q', label: 'quit' }, { keys: 'r', label: 'refresh' }]} />`,
    notes: `A terminal UI has no menus to discover, so this is usually the only place a
reader learns what the keys are. Keep it to the keys that work *here* - a hint
line listing everything the application can do teaches nothing.

Commands registered with the \`hints\` slot can populate this from the registry
rather than from a literal, which keeps the line honest as the screen changes.`,
    seeAlso: `- [Commands](../../platform/commands.md) - the \`hints\` slot
- [StatusBar](status-bar.md) - state rather than available keys`,
  },

  Wizard: {
    summary: 'Numbered steps, with the ones behind you marked done.',
    example: `import { Wizard } from '@textui/widgets';

<Wizard
  steps={[
    { id: 'source', label: 'Source' },
    { id: 'review', label: 'Review' },
  ]}
  activeId="review"
  completedIds={['source']}
/>`,
    notes: `The indicator only. It shows where you are in a sequence; it holds no step
content and enforces no order, so the screen decides what a step contains and
whether you may skip one.

\`orientation="vertical"\` runs it down the side, which fits a narrow terminal
better once there are more than about four steps.`,
    seeAlso: `- [Tabs](tabs.md) - when the order does not matter
- [Form](../input/form.md) - what a step usually holds`,
  },

  // ---- overlays -----------------------------------------------------------

  Dialog: {
    summary: 'A modal panel with a title and a row of actions.',
    example: `import { Dialog } from '@textui/widgets';

<Dialog
  title="Delete namespace?"
  actions={[
    { id: 'cancel', label: 'Cancel' },
    { id: 'delete', label: 'Delete', tone: 'danger' },
  ]}
  onClose={() => {}}
>
  <text content="This cannot be undone." />
</Dialog>`,
    notes: `Rendered on the modal [layer](../../platform/layers.md), which is what traps
focus inside it and dismisses it on escape - the dialog does not implement
either, and neither should anything else that needs them.

Actions are laid out for you, so OK and Cancel line up regardless of order -
see [\`Button\`](../input/button.md) on why \`solid\` and \`outline\` are the same
height.`,
    seeAlso: `- [PromptDialog](prompt-dialog.md) - a dialog that asks for a string
- [Layers](../../platform/layers.md) - trapping and dismissal
- [DangerZone](../input/danger-zone.md) - for irreversible actions, a better guard`,
  },

  PromptDialog: {
    summary: 'A dialog that asks for one string.',
    example: `import { PromptDialog } from '@textui/widgets';

<PromptDialog
  title="Rename"
  message="New name for this service"
  initialValue="api"
  onSubmit={(value) => console.log(value)}
  onCancel={() => {}}
/>`,
    notes: `Enter submits, escape cancels. \`mask\` turns it into a password field.

Usually reached through the app's \`prompt\` helper rather than mounted by hand -
that opens it on the modal layer and resolves a promise with the answer, which
is what calling code actually wants.`,
    seeAlso: `- [Dialog](dialog.md) - when the answer is a choice, not a string
- [TextInput](../input/text-input.md) - the field inside it`,
  },

  Tooltip: {
    summary: 'A short label attached to whatever it wraps.',
    example: `import { Tooltip } from '@textui/widgets';

<Tooltip text="Restarts every worker">
  <text content="Restart all" />
</Tooltip>`,
    notes: `A terminal has no hover for most inputs, so this shows on focus rather than on
pointer - which means it only ever appears on something focusable.

That makes it weaker than a tooltip on the web, and a
[\`KeyHints\`](key-hints.md) line or a \`description\` prop is often the better
answer.`,
    seeAlso: `- [KeyHints](key-hints.md) - discoverability that does not need focus
- [Base props](../base-props.md) - the \`description\` prop`,
  },

  Toast: {
    summary: 'A message that arrives and leaves on its own.',
    example: `import { Toast } from '@textui/widgets';

<Toast tone="success" message="Deployed to eu-west-1" />`,
    notes: `The message itself. Placement, stacking and expiry belong to
[\`ToastHost\`](toast-host.md), and one is normally created through the app's
notify helper rather than mounted directly.

Never put anything in a toast that the reader must act on - it will be gone.`,
    seeAlso: `- [ToastHost](toast-host.md) - where they stack and when they leave
- [Alert](../display/alert.md) - a message that stays`,
  },

  ToastHost: {
    summary: 'Where toasts stack, and the layer they live on.',
    example: `import { ToastHost } from '@textui/widgets';

<ToastHost anchor="bottom-right" />`,
    notes: `Mount one, once, near the root - or let a [shell](../surfaces/plain-shell.md)
do it, which the shipped ones already do by giving the notification layer a
home.

It listens for notifications and renders them on the notification layer, above
everything except debug. \`anchor\` decides the corner.`,
    seeAlso: `- [Toast](toast.md) - the message
- [Layers](../../platform/layers.md) - why notifications are their own plane`,
  },

  LayerScope: {
    summary: 'Puts its children on a named layer, optionally trapping focus.',
    example: `import { LayerScope } from '@textui/widgets';

<LayerScope scopeId="inspector" trap>
  <text content="focus cannot leave this subtree" />
</LayerScope>`,
    notes: `The building block under [\`Dialog\`](dialog.md) and the menus. Reach for it
when you need modal behaviour around something that is not a dialog - an
inline editor that must keep the keyboard until it is finished, for instance.

\`trap\` keeps tab inside the subtree. Without it the scope groups for
dismissal and ordering but focus still moves through as usual.`,
    seeAlso: `- [Layers](../../platform/layers.md) - the planes and their order
- [Focus](../../platform/focus.md) - scopes and traps
- [Dialog](dialog.md) - this, already assembled`,
  },

  CommandPalette: {
    summary: 'Search the command registry and run what you find.',
    example: `import { CommandPalette } from '@textui/widgets';

<CommandPalette placeholder="Run a command" onClose={() => {}} />`,
    notes: `It searches the **command registry**, not a list you pass it. Anything
registered with the \`palette\` slot is in it, which means a feature becomes
reachable by registering a command and doing nothing else.

That is the whole argument for commands over handlers: the palette, the
keybinding and the menu item cannot drift apart, because there is one
implementation and three ways in.

\`commands\` overrides the registry for the rare screen that wants its own list;
\`execute={false}\` reports the choice through \`onRun\` instead of running it.`,
    seeAlso: `- [Commands](../../platform/commands.md) - registering and the \`palette\` slot
- [Menu](menu.md) - a fixed list rather than a search`,
  },

  // ---- surfaces and shells ------------------------------------------------

  SurfaceArea: {
    summary: 'Renders one named surface wherever it is placed.',
    example: `import { SurfaceArea } from '@textui/widgets';

<SurfaceArea surface="main" />`,
    notes: `A surface is a named region that mounts are opened into. \`SurfaceArea\` is
where one appears on screen, and how it arranges what is in it comes from the
surface's own layout state rather than from here - so a pane can switch from
tabs to a split at runtime without the markup changing.

**The name is yours to invent.** \`SurfaceName\` suggests the nine the shells
use, but the registry never checks a name against a list; the first time it
sees one it hands out default state. An application placing its own surfaces
needs no shell at all.

Surfaces nest: a mount target is a node and this is a component, so a
\`SurfaceArea\` inside another needs no support from anywhere.

\`layout\` pins the arrangement instead of reading it from state. \`fallback\`
renders when nothing is mounted.`,
    seeAlso: `- [MountView](mount-view.md) - rendering one mount
- [TabsLayout](tabs-layout.md) and the other layouts - the arrangements
- [WorkbenchShell](workbench-shell.md) - surfaces already placed for you`,
  },

  MountView: {
    summary: "Renders a single mount's target.",
    example: `import { MountView } from '@textui/widgets';
import type { Mount } from '@textui/core';

declare const mount: Mount;

<MountView mount={mount} />`,
    notes: `Every shipped layout delegates to this. A layout decides *where* a mount goes;
\`MountView\` decides what it draws, applying the mount's data context and its
display metadata.

You need it when writing a layout of your own, and almost never otherwise.`,
    seeAlso: `- [SurfaceArea](surface-area.md) - the region mounts appear in
- [Extension points](../../platform/extending.md) - registering a layout`,
  },

  SingleLayout: {
    summary: 'Shows one mount and ignores the rest.',
    example: `import { BUILTIN_LAYOUTS } from '@textui/widgets';

console.log(BUILTIN_LAYOUTS.map((layout) => layout.name));`,
    notes: `A layout is not mounted directly - it is registered, and a surface names it.
\`registerBuiltins\` registers all seven, and a surface picks one through its
layout state.

\`single\` shows the active mount and draws nothing for the others. It is the
right choice for a surface that holds one thing at a time and does not need a
strip of tabs to say so.`,
    seeAlso: `- [TabsLayout](tabs-layout.md) - the same, with a chooser
- [SurfaceArea](surface-area.md) - selecting a layout`,
  },

  TabsLayout: {
    summary: "Arranges a surface's mounts as tabs.",
    example: `import { BUILTIN_LAYOUTS } from '@textui/widgets';

const tabs = BUILTIN_LAYOUTS.find((layout) => layout.name === 'tabs');`,
    notes: `One mount visible, a strip naming the others. Each tab's label comes from the
mount's \`display\` metadata, so opening a mount is all it takes to add a tab.

This is the surface-level counterpart to [\`Tabs\`](../navigation/tabs.md).
Use that one for panels you are laying out yourself; use this when the panels
are mounts and their set changes at runtime.`,
    seeAlso: `- [Tabs](../navigation/tabs.md) - the plain control
- [StackLayout](stack-layout.md) - all of them at once`,
  },

  StackLayout: {
    summary: 'Stacks every mount in the surface, one after another.',
    example: `import { BUILTIN_LAYOUTS } from '@textui/widgets';

const stack = BUILTIN_LAYOUTS.find((layout) => layout.name === 'stack');`,
    notes: `All mounts visible, in order, down the surface. What a sidebar of collapsible
sections wants, and what a surface holding a single mount degrades to
harmlessly.`,
    seeAlso: `- [SplitLayout](split-layout.md) - two mounts with a divide
- [RailLayout](rail-layout.md) - icons rather than panels`,
  },

  SplitLayout: {
    summary: 'Two mounts, side by side, with a divider.',
    example: `import { BUILTIN_LAYOUTS } from '@textui/widgets';

const split = BUILTIN_LAYOUTS.find((layout) => layout.name === 'split');`,
    notes: `The surface-level [\`Splitter\`](../layout/splitter.md). Where the divide sits
is surface state rather than a prop, so it survives the mounts changing and can
be moved by a command.

More than two mounts and the extras are stacked into the second pane.`,
    seeAlso: `- [Splitter](../layout/splitter.md) - the plain component
- [StackLayout](stack-layout.md) - no divide`,
  },

  BarLayout: {
    summary: 'Mounts along a single row.',
    example: `import { BUILTIN_LAYOUTS } from '@textui/widgets';

const bar = BUILTIN_LAYOUTS.find((layout) => layout.name === 'bar');`,
    notes: `One row, mounts laid left to right, ordered by each mount's \`order\`. What the
\`header\` and \`status\` surfaces use.

A mount that does not fit is dropped rather than wrapped, because a status bar
that becomes two rows moves everything above it.`,
    seeAlso: `- [StatusBar](../navigation/status-bar.md) - the component for one such row
- [RailLayout](rail-layout.md) - the vertical equivalent`,
  },

  RailLayout: {
    summary: 'A narrow vertical strip of mounts, usually icons.',
    example: `import { BUILTIN_LAYOUTS } from '@textui/widgets';

const rail = BUILTIN_LAYOUTS.find((layout) => layout.name === 'rail');`,
    notes: `The activity strip down the left of a workbench. Each mount contributes an
icon from its \`display\` metadata, and the rail stays narrow whatever they are.

Selecting one is what usually changes what the \`sidebar\` surface shows, but
that wiring is the application's - the rail reports, it does not route.`,
    seeAlso: `- [WorkbenchShell](workbench-shell.md) - where a rail normally lives
- [BarLayout](bar-layout.md) - horizontal`,
  },

  InlineLayout: {
    summary: 'Mounts rendered one after another with no chrome at all.',
    example: `import { BUILTIN_LAYOUTS } from '@textui/widgets';

const inline = BUILTIN_LAYOUTS.find((layout) => layout.name === 'inline');`,
    notes: `No tabs, no divider, no frame - the mounts and nothing else. For a surface
that is a hole in someone else's layout, where any decoration would be a second
frame around a thing already framed.`,
    seeAlso: `- [StackLayout](stack-layout.md) - the same order, with the surface's spacing
- [SurfaceArea](surface-area.md) - pinning a layout with \`layout\``,
  },

  PlainShell: {
    summary: 'Header, main, status. The smallest arrangement that is still a shell.',
    example: `import { createApp } from '@textui/core';
import { registerBuiltins } from '@textui/widgets';
import { createNodeTerminal } from '@textui/terminal';

const app = createApp({
  terminal: createNodeTerminal(),
  shell: 'plain',
  onBoot: (app) => void registerBuiltins(app),
});`,
    notes: `A shell decides where the surfaces go and nothing else. Switching between the
four shipped ones changes the frame without touching a single mount, which is
the property the whole surface system exists to give you.

\`plain\` places \`header\`, \`main\` and \`status\`. Anything opened into a surface
it does not place simply does not appear - which is worth knowing when a mount
seems to vanish.`,
    seeAlso: `- [WorkbenchShell](workbench-shell.md) - rail, sidebar, panel and aside as well
- [Surfaces, shells and resources](../surfaces.md) - the nine surface names`,
  },

  ConsoleShell: {
    summary: 'A dense, bordered frame for a monitoring screen.',
    example: `import { createApp } from '@textui/core';
import { registerBuiltins } from '@textui/widgets';
import { createNodeTerminal } from '@textui/terminal';

const app = createApp({
  terminal: createNodeTerminal(),
  shell: 'console',
  onBoot: (app) => void registerBuiltins(app),
});`,
    notes: `Tight spacing and borders everywhere - for a screen watched continuously,
where density beats airiness and a boundary between panes matters.

Same surfaces as [\`PlainShell\`](plain-shell.md) plus \`panel\`. The mounts do
not change; only the frame does.`,
    seeAlso: `- [PaperShell](paper-shell.md) - the opposite trade
- [Themes](../../themes/) - which also change density`,
  },

  PaperShell: {
    summary: 'An airy, mostly borderless frame for something read rather than watched.',
    example: `import { createApp } from '@textui/core';
import { registerBuiltins } from '@textui/widgets';
import { createNodeTerminal } from '@textui/terminal';

const app = createApp({
  terminal: createNodeTerminal(),
  shell: 'paper',
  onBoot: (app) => void registerBuiltins(app),
});`,
    notes: `Generous spacing, few rules. For a report, a document or a wizard - anything
read once rather than monitored.

This is the shell that exercises the "no border" path in every component, which
is why [\`Panel\`](../layout/panel.md) has to render its title as a heading row
rather than into a rule.`,
    seeAlso: `- [ConsoleShell](console-shell.md) - the opposite trade
- [Panel](../layout/panel.md) - what changes when borders go away`,
  },

  WorkbenchShell: {
    summary: 'Rail, sidebar, main, panel, aside and status - the IDE arrangement.',
    example: `import { createApp } from '@textui/core';
import { registerBuiltins } from '@textui/widgets';
import { createNodeTerminal } from '@textui/terminal';

const app = createApp({
  terminal: createNodeTerminal(),
  shell: 'workbench',
  onBoot: (app) => void registerBuiltins(app),
});`,
    notes: `The largest of the four, and the one worth starting from for an application
with more than one thing on screen at once.

Every region is a surface, so which of them are visible is store state: a
sidebar can be collapsed, a panel toggled, an aside opened, all by writing a
path rather than by re-rendering a tree.`,
    seeAlso: `- [SurfaceArea](surface-area.md) - placing surfaces without a shell
- [RailLayout](rail-layout.md) - what the rail surface usually uses
- [Surfaces, shells and resources](../surfaces.md)`,
  },

  // ---- resources and documents --------------------------------------------

  ResourceView: {
    summary: 'Opens a URI with whichever viewer the registry says fits.',
    example: `import { ResourceView } from '@textui/documents';

<ResourceView uri="file:///etc/hosts" />`,
    notes: `The entry point to the whole resource system: give it a URI and it resolves
the provider, reads the resource, asks the viewer registry what opens that kind
and renders it.

\`viewerId\` pins one instead - what a screen passes after the reader has chosen
from [\`ResourceOpenWith\`](resource-open-with.md). \`mode="edit"\` asks for an
editor rather than a viewer where one is registered.

\`uri\` accepts \`null\` so a pane can render its own empty state while nothing
is open.`,
    seeAlso: `- [Documents](../../documents/) - providers, adapters and viewers
- [ResourceExplorer](resource-explorer.md) - choosing what to open
- [ResourceOpenWith](resource-open-with.md) - choosing how`,
  },

  ResourceExplorer: {
    summary: 'A tree over a resource provider.',
    example: `import { ResourceExplorer } from '@textui/documents';

<ResourceExplorer root="file:///srv" onOpen={(resource) => console.log(resource.uri)} />`,
    notes: `Lists children lazily through the provider for \`root\`, so a directory is read
when it is expanded rather than up front.

\`onSelect\` fires as the cursor moves and \`onOpen\` on enter - the same split
[\`List\`](../display/list.md) makes, and for the same reason: a preview pane
should follow the cursor, and opening should not.`,
    seeAlso: `- [ResourceView](resource-view.md) - rendering what was opened
- [Tree](../display/tree.md) - the control underneath
- [Providers](../../documents/providers.md)`,
  },

  ResourceActions: {
    summary: 'The actions registered for this resource kind.',
    example: `import { ResourceActions } from '@textui/documents';

<ResourceActions resource={null} slot="context" onRun={(id) => console.log(id)} />`,
    notes: `Reads the action registry rather than a list you pass, so an extension adding
an action to a kind appears here without anything being rewired.

\`slot\` selects where the actions were registered to appear - \`context\` for a
menu, other slots for a toolbar or a header.`,
    seeAlso: `- [Viewers, editors and actions](../../documents/viewers.md)
- [Menu](../navigation/menu.md) - what usually renders them`,
  },

  ResourceOpenWith: {
    summary: 'The viewers that can open this resource, for the reader to choose.',
    example: `import { ResourceOpenWith } from '@textui/documents';

<ResourceOpenWith resource={null} onChoose={(viewer) => console.log(viewer.id)} />`,
    notes: `More than one viewer can claim a kind - JSON opens in a syntax-highlighted
view or a collapsible tree, and neither is always right. This lists the
candidates; pass the chosen id back as
[\`ResourceView\`](resource-view.md)'s \`viewerId\`.`,
    seeAlso: `- [ResourceView](resource-view.md) - the \`viewerId\` prop
- [JsonViewer](json-viewer.md), [JsonTreeViewer](json-tree-viewer.md) - two viewers, one kind`,
  },

  ResourceBreadcrumb: {
    summary: 'The path of a URI, as a trail you can walk back up.',
    example: `import { ResourceBreadcrumb } from '@textui/documents';

<ResourceBreadcrumb uri="file:///srv/api/main.ts" root="file:///srv" />`,
    notes: `Splits the URI into segments and renders them as a
[\`Breadcrumb\`](../navigation/breadcrumb.md). \`root\` trims the prefix so the
trail starts at the workspace rather than at the filesystem root.`,
    seeAlso: `- [Breadcrumb](../navigation/breadcrumb.md) - the control underneath
- [ResourceExplorer](resource-explorer.md) - the tree it usually sits above`,
  },

  TextViewer: {
    summary: 'Plain text, for a resource with no more specific viewer.',
    example: `import { TextViewer } from '@textui/documents';

<TextViewer uri="file:///etc/hosts" />`,
    notes: `Takes a \`resource\`, a \`uri\` or \`content\` directly - the last of which is
what makes it testable without a provider.

Registered against text kinds, and beaten by any viewer that claims something
more specific.`,
    seeAlso: `- [CodeViewer](../display/code-viewer.md) - the component underneath
- [FallbackViewer](fallback-viewer.md) - when even text is not right`,
  },

  MarkdownViewer: {
    summary: 'A scrolling document view for markdown resources.',
    example: `import { MarkdownViewer } from '@textui/documents';

<MarkdownViewer uri="file:///README.md" />`,
    notes: `The scrolling counterpart to
[\`MarkdownView\`](../display/markdown-view.md): it lays the document out once
with \`layoutMarkdown\`, owns the viewport, and hands the view a \`window\` of
rows to paint.

That split is why a message in a transcript and a document in a pane can share
one renderer while only one of them scrolls.`,
    seeAlso: `- [MarkdownView](../display/markdown-view.md) - the non-scrolling renderer
- [ResourceView](resource-view.md) - what selects this viewer`,
  },

  FallbackViewer: {
    summary: 'What opens when nothing else claims the resource.',
    example: `import { FallbackViewer } from '@textui/documents';

<FallbackViewer uri="file:///srv/blob.bin" />`,
    notes: `Shows what is known - the URI, the kind, the size - and says plainly that
there is no viewer for it. It exists so an unknown kind is a readable message
rather than an empty pane or a crash.

Registering a viewer for the kind is what replaces it.`,
    seeAlso: `- [Viewers, editors and actions](../../documents/viewers.md) - registering one
- [EmptyState](../display/empty-state.md) - the component it reads like`,
  },

  JsonViewer: {
    summary: 'JSON as highlighted text.',
    example: `import { JsonViewer } from '@textui/documents';

<JsonViewer content={'{ "ok": true }'} />`,
    notes: `Ships with the JSON adapter rather than with the core catalog, so it is
registered when that adapter is - which is why it and
[\`JsonTreeViewer\`](json-tree-viewer.md) are in \`@textui/documents\`.

Text is the right default: it preserves key order and formatting, and a diff of
it is readable.`,
    seeAlso: `- [JsonTreeViewer](json-tree-viewer.md) - the collapsible view of the same data
- [ResourceOpenWith](resource-open-with.md) - letting the reader pick between them`,
  },

  JsonTreeViewer: {
    summary: 'JSON as a collapsible tree.',
    example: `import { JsonTreeViewer } from '@textui/documents';

<JsonTreeViewer content={'{ "ok": true }'} />`,
    notes: `The other viewer for the same kind. A tree is better for finding one value in
a large document and worse for reading the document, which is exactly why both
are registered and the reader chooses.`,
    seeAlso: `- [JsonViewer](json-viewer.md) - the text view
- [Tree](../display/tree.md) - the control underneath`,
  },

  CodeEditor: {
    summary: 'A writable code view, with a cursor, a selection and the clipboard.',
    example: `import { CodeEditor } from '@textui/documents';

<CodeEditor uri="file:///srv/main.ts" onChange={(value) => console.log(value.length)} />`,
    notes: `[\`CodeViewer\`](../display/code-viewer.md) with editing on top: a real caret,
a selection, clipboard integration, and \`onChange\` for the text.

\`onCursor\` and \`onSelection\` report position and selection size for a status
bar. \`readonly\` keeps the caret and the selection while refusing edits, which
is what a diff or a preview wants.

Given a \`uri\` it reads and writes through the document buffer, so dirty state
and saving are the buffer's - see [Document buffers](../../documents/buffers.md).`,
    seeAlso: `- [CodeViewer](../display/code-viewer.md) - read-only
- [Document buffers](../../documents/buffers.md) - dirty state and saving`,
  },

  ColorText: {
    summary: 'Multiline text coloured cell by cell - a ramp, a palette per line, or a function.',
    example: `import { ColorText } from '@textui/widgets';

<ColorText ink={{ gradient: ['cyan', 'magenta'] }} content={banner} alignBlock />`,
    notes: `A \`text\` takes one colour for the whole run, which is right for nearly
everything and no answer at all where the colour *is* the content - a banner, a
ramp across a title, a palette walked down a block of ascii art. Everything else
about this is a \`text\`: \`wrap\`, \`truncate\`, \`textAlign\` and the style keys
all mean here what they mean there.

\`ink\` is spelled three ways, and the first two are data:

\`\`\`tsx
<box direction="column">
  <ColorText ink={{ gradient: ['#ff5f6d', '#ffc371'], axis: 'y' }} content={text} />
  <ColorText ink={['danger', 'warning', 'success']} content={text} />
  <ColorText ink={{ cycle: palette, every: [4, 3] }} content={text} />
  <ColorText ink={(cell) => (cell.index % 2 ? 'muted' : 'accent')} content={text} />
</box>
\`\`\`

A **ramp** runs across the columns, down the lines, or corner to corner. It is
measured against the widest line of the block, so the rows of a banner share one
gradient and the colours line up down it; \`per: 'line'\` restarts it on each
line, which is what ragged prose wants.

A **cycle** walks a palette. An array on its own is the short spelling of one
colour per line. \`every\` is how much of the text each colour takes - a number,
or a repeating pattern of runs, so \`[4, 3]\` is four cells then three. The count
restarts on each line, which is what keeps the bands vertical; \`continuous\`
carries it over the line breaks and leans them into a diagonal. \`unit\` picks
what advances the colour: \`cell\` (the default, and the one that keeps a block
aligned), \`grapheme\`, \`letter\`, \`word\` or \`line\`.

A **function** is handed each cell and answers with a colour, a whole
\`CellStyle\`, or nothing - and nothing means "leave this one alone", which is
what makes an ink that colours only the vowels two lines long. The cell carries
a \`col\` *and* an \`index\` because they stop being the same number the moment
the text is not plain ascii: colour by \`index\` and paint at \`col\`, or a
gradient shears through the first wide character it meets.

Only the data forms survive being written in a JSON screen. A function prop
cannot be serialized - the same trade [\`canvas\`](../primitives/canvas.md)
makes with \`draw\`, and for the same reason: this paints on one.

Two consequences of that canvas are worth knowing. **Inherited colour stops
here**: a cell the ink declines takes this component's own \`fg\`, not the one a
parent row would have handed a \`text\`, so a \`ColorText\` inside something that
recolours its children when selected has to be told. And **a block that wraps
asks for no width** - it fills what it is given, the way anything that wraps
must; a block that does not wrap is as wide as its widest line and says so.

\`alignBlock\` is for pictures. \`textAlign\` centres every line over its own
middle, which is right for prose and shears a banner, because five rows of block
letters do not have equal widths once the trailing spaces are gone. Under
\`alignBlock\` the whole block is placed once and the lines keep their offsets
from each other.

The colour is decoration and never the message. A 16-colour session flattens a
six-stop ramp into a couple of bands and a piped log loses all of it, so
anything the reader has to know has to be in the words.`,
    seeAlso: `- [text](../primitives/text.md) - one colour, and the right answer nearly always
- [canvas](../primitives/canvas.md) - the primitive underneath, for cells that are not text
- [Themes](../../themes/tokens.md) - the tokens an ink can name`,
  },

  Marquee: {
    summary: 'Text too long for its box, read by sliding it while it has the cursor.',
    example: `import { Marquee } from '@textui/widgets';

<Marquee content="a service name far too long for the column it is in" active />`,
    notes: `Only ever a last resort for text that genuinely cannot fit. It moves, and
movement in a terminal is expensive attention - so \`active\` gates it, and the
usual thing to gate it on is whether the row has the cursor. A list of twenty
sliding labels is unreadable; one sliding label under the selection is useful.

\`speed\` is cells per second, \`dwell\` the pause at each end in milliseconds,
and \`fps\` how often it repaints. Lowering \`fps\` costs smoothness and saves
redraws, which matters over ssh.

Where truncation is acceptable it is nearly always the better answer -
[\`text\`](../primitives/text.md) with \`truncate="middle"\` keeps both ends of a
path visible and never moves.`,
    seeAlso: `- [text](../primitives/text.md) - \`truncate\` and \`wrap\`, the static answers
- [List](list.md) - where \`active\` usually comes from`,
  },

  ResourcePanel: {
    summary: 'A place a resource is shown, by whichever renderer is registered for it.',
    example: `import { ResourcePanel } from '@textui/widgets';

<ResourcePanel uri="file:///srv/api/main.ts" />`,
    notes: `The panel is the *place*; what fills it is decided by the resource registry.
Hand it a URI and it asks what renders that kind - an editor when \`mode\` is
\`'edit'\` and one is registered, a viewer otherwise, the fallback when nothing
claims it.

\`uri\` takes \`null\` so a panel can stand empty with \`emptyTitle\` rather than
being unmounted, which keeps the layout still while nothing is open.

\`renderer\` pins one instead of asking, and \`rendererProps\` is passed through
to it. Registering \`registerBuiltins\` also registers the panel's commands -
"open with" reads its options off the resource registry, so a host that mounts
a panel has already said everything those commands need. The keys stay yours.`,
    seeAlso: `- [ResourceView](resource-view.md) - the same resolution without the panel chrome
- [Viewers, editors and actions](../../documents/viewers.md) - what gets registered
- [Commands](../../platform/commands.md) - the panel's own commands`,
  },
};
