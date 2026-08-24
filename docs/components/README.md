---
title: Components
nav_order: 6
has_children: true
permalink: /components/
---

# Components
{: .no_toc }

Most of these are importable from `@textui/core`; the resource and document
components come from `@textui/documents` and are marked as such below. Calling
`registerBuiltins(app)` puts the core catalog into the component registry,
which is what lets a node graph name `'Table'` and get one.

Two pages apply to all of them: [Base props](base-props.md) for what every node
accepts, and [Nodes](nodes.md) for writing one as data rather than as JSX.

## The four primitives

The layout engine and the painter only ever see these, which is why adding a
component costs a function rather than a case in the engine.

| Primitive | What it is |
| --- | --- |
| `box` | The container. Flex layout, background, border, title, footer, scroll |
| `text` | A run of text. Wraps, truncates, aligns |
| `canvas` | Direct cell painting. The escape hatch charts use |
| `spacer` | Empty space, greedy when given `flex` |

Every node also accepts `role`, `label`, `focusable`, `onKey`, `onClick`,
`disabled` and `selected` - so a bare `box` can take focus and handle keys
without a hook.

## The catalog

<!-- props:start -->

97 components. Every one has a page.

### The four primitives

| | |
| --- | --- |
| [`box`](primitives/box.md) | The container. Flex layout, background, border, title and footer. |
| [`text`](primitives/text.md) | A run of text. Wraps, truncates and aligns within its box. |
| [`canvas`](primitives/canvas.md) | Direct cell painting. The escape hatch charts and gauges use. |
| [`spacer`](primitives/spacer.md) | Empty space. Sized, or greedy when given flex. |

### Layout

| | |
| --- | --- |
| [`Row`](layout/row.md) | Horizontal flex container. |
| [`Column`](layout/column.md) | Vertical flex container. |
| [`Center`](layout/center.md) | Centres its children. |
| [`Grid`](layout/grid.md) | Equal-width columns, wrapping into rows. |
| [`Panel`](layout/panel.md) | Titled region. Bordered or airy, following the theme. |
| [`Divider`](layout/divider.md) | A rule, optionally labelled. |
| [`Spacer`](layout/spacer.md) | Empty space, greedy by default. |
| [`Stack`](layout/stack.md) | Column with themed spacing. |
| [`ScrollView`](layout/scroll-view.md) | Scrolling viewport with keyboard and wheel support. |
| [`Splitter`](layout/splitter.md) | Two panes with a divider. |

### Display

| | |
| --- | --- |
| [`Heading`](display/heading.md) | Section heading, three levels. |
| [`Label`](display/label.md) | Secondary text with a semantic tone. |
| [`Badge`](display/badge.md) | Small status marker; carries a glyph as well as a colour. |
| [`StatusDot`](display/status-dot.md) | The shared status vocabulary: up, degraded, down. |
| [`Card`](display/card.md) | Bordered block with a title. |
| [`Marquee`](display/marquee.md) | Text too long for its box, read by sliding it while it has the cursor. |

### Data

| | |
| --- | --- |
| [`KeyValue`](display/key-value.md) | Aligned label/value pairs. |
| [`Timeline`](display/timeline.md) | Ordered events down a rail. |
| [`List`](display/list.md) | Selectable rows with keyboard navigation. |
| [`Table`](display/table.md) | Columns that drop by priority as space runs out. |
| [`Tree`](display/tree.md) | Expandable hierarchy. |
| [`Pagination`](display/pagination.md) | Page of pages. |
| [`LogViewer`](display/log-viewer.md) | Streaming lines that follow the tail until you scroll. |
| [`CodeViewer`](display/code-viewer.md) | A scrolling, syntax-coloured file viewer. |
| [`MarkdownView`](display/markdown-view.md) | Markdown drawn into the width it was given. Does not scroll. |
| [`Feed`](display/feed.md) | A viewport over entries of any height, with a cursor and a tail it follows. |

### Charts

| | |
| --- | --- |
| [`Sparkline`](display/sparkline.md) | One row of block glyphs; eight levels per cell. |
| [`BarChart`](display/bar-chart.md) | Labelled bars, horizontal or vertical. |
| [`LineChart`](display/line-chart.md) | Braille plot at 2x4 the cell resolution. |
| [`AreaChart`](display/area-chart.md) | A line chart, filled. |
| [`Histogram`](display/histogram.md) | Bucketed distribution. |
| [`Gauge`](display/gauge.md) | A reading against thresholds. |
| [`Heatmap`](display/heatmap.md) | A grid of intensities. |

### Feedback and status

| | |
| --- | --- |
| [`Alert`](display/alert.md) | A message with an icon and a tone. |
| [`Progress`](display/progress.md) | Determinate or indeterminate bar, sub-cell resolution. |
| [`Spinner`](display/spinner.md) | Animated activity indicator. |
| [`Skeleton`](display/skeleton.md) | Loading placeholder. |
| [`EmptyState`](display/empty-state.md) | Nothing here, and what to do about it. |
| [`ErrorState`](display/error-state.md) | A failure, with its message. |

### Controls

| | |
| --- | --- |
| [`Button`](input/button.md) | Focusable action. |
| [`Checkbox`](input/checkbox.md) | On, off, or mixed. |
| [`Switch`](input/switch.md) | Two-state toggle with words, not only colour. |
| [`RadioGroup`](input/radio-group.md) | One of several. |
| [`Slider`](input/slider.md) | A value along a track. |
| [`TextArea`](input/text-area.md) | A field that is a paragraph: grows, scrolls, and gives back the keys it does not want. |
| [`TextInput`](input/text-input.md) | Single-line text with a real caret. |
| [`Select`](input/select.md) | Pick from a list, collapsed or open. |
| [`SearchBox`](input/search-box.md) | A text field that looks like search. |

### Forms

| | |
| --- | --- |
| [`Form`](input/form.md) | Provides form state to its fields. |
| [`Field`](input/field.md) | Label, control and error, aligned. |
| [`FormSection`](input/form-section.md) | A titled group of fields. |
| [`FormActions`](input/form-actions.md) | Submit and cancel. |
| [`DangerZone`](input/danger-zone.md) | Destructive action, fenced off. |

### Navigation

| | |
| --- | --- |
| [`Tabs`](navigation/tabs.md) | Tab strip or segmented control. |
| [`Breadcrumb`](navigation/breadcrumb.md) | Where you are, collapsing in the middle when narrow. |
| [`Menu`](navigation/menu.md) | Keyboard-driven list of actions. |
| [`StatusBar`](navigation/status-bar.md) | One line, segments left and right. |
| [`Toolbar`](navigation/toolbar.md) | A row of actions. |
| [`KeyHints`](navigation/key-hints.md) | What the keys do, right now. |
| [`Wizard`](navigation/wizard.md) | Ordered steps with progress. |

### Overlays

| | |
| --- | --- |
| [`Dialog`](navigation/dialog.md) | Modal box with actions; traps focus and restores it. |
| [`PromptDialog`](navigation/prompt-dialog.md) | One-field dialog behind the `prompt` helper. |
| [`PathPicker`](navigation/path-picker.md) | Walk the resource tree and pick a file or a folder. |
| [`Tooltip`](navigation/tooltip.md) | Small anchored hint. |
| [`Toast`](navigation/toast.md) | Transient notification. |
| [`ToastHost`](navigation/toast-host.md) | Where toasts stack. |
| [`LayerScope`](navigation/layer-scope.md) | The focus scope a layer lives in; makes `trapFocus` real. |
| [`CommandPalette`](navigation/command-palette.md) | Fuzzy search over the command registry. |

### Surfaces and shells

| | |
| --- | --- |
| [`SurfaceArea`](surfaces/surface-area.md) | Renders one surface through its active layout. |
| [`MountView`](surfaces/mount-view.md) | Renders one mount target. |
| [`SingleLayout`](surfaces/single-layout.md) | Only the active mount. |
| [`TabsLayout`](surfaces/tabs-layout.md) | Tab strip plus the active mount. |
| [`StackLayout`](surfaces/stack-layout.md) | All mounts, stacked with headings. |
| [`SplitLayout`](surfaces/split-layout.md) | All mounts, side by side. |
| [`BarLayout`](surfaces/bar-layout.md) | All mounts on one line. |
| [`RailLayout`](surfaces/rail-layout.md) | Icons only. |
| [`InlineLayout`](surfaces/inline-layout.md) | All mounts, no chrome. |
| [`PlainShell`](surfaces/plain-shell.md) | Main and status, no frame. |
| [`ConsoleShell`](surfaces/console-shell.md) | Dense bordered operator console. |
| [`PaperShell`](surfaces/paper-shell.md) | Airy and borderless. |
| [`WorkbenchShell`](surfaces/workbench-shell.md) | Full frame: rail, sidebar, tabs, panel, status. |

### Resources and documents

| | |
| --- | --- |
| [`ResourcePanel`](surfaces/resource-panel.md) | A place a resource is shown, by whichever renderer is registered for it. |
| [`TextViewer`](surfaces/text-viewer.md) <sup>documents</sup> | Plain text with a line-number gutter. |
| [`MarkdownViewer`](surfaces/markdown-viewer.md) <sup>documents</sup> | Headings, lists, rules, quotes and fenced code. |
| [`FallbackViewer`](surfaces/fallback-viewer.md) <sup>documents</sup> | What an unregistered kind gets. |
| [`ResourceView`](surfaces/resource-view.md) <sup>documents</sup> | Displays a resource through the registry. |
| [`ResourceExplorer`](surfaces/resource-explorer.md) <sup>documents</sup> | Browse and open resources. |
| [`ResourceActions`](surfaces/resource-actions.md) <sup>documents</sup> | Actions registered for a kind. |
| [`ResourceOpenWith`](surfaces/resource-open-with.md) <sup>documents</sup> | Choose among registered viewers. |
| [`ResourceBreadcrumb`](surfaces/resource-breadcrumb.md) <sup>documents</sup> | The path to a resource. |
| [`JsonViewer`](surfaces/json-viewer.md) <sup>documents</sup> | JSON source, coloured by the registered highlighter. |
| [`JsonTreeViewer`](surfaces/json-tree-viewer.md) <sup>documents</sup> | JSON as an expandable structure. |
| [`CodeEditor`](surfaces/code-editor.md) <sup>documents</sup> | Edit a document buffer, with a caret that has a column. |
<!-- props:end -->
