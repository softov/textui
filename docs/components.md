# The component catalog

Everything here is importable from `@textui/core`. Calling `registerBuiltins(app)` puts the whole catalog into the component registry, which is what lets a node graph name `'Table'` and get one.

## The four primitives

The layout engine and the painter only ever see these, which is why adding a component costs a function rather than a case in the engine.

| Primitive | What it is |
| --- | --- |
| `box` | The container. Flex layout, background, border, title, footer, scroll |
| `text` | A run of text. Wraps, truncates, aligns |
| `canvas` | Direct cell painting. The escape hatch charts use |
| `spacer` | Empty space, greedy when given `flex` |

Every node also accepts `role`, `label`, `focusable`, `onKey`, `onClick`, `disabled` and `selected` - so a bare `box` can take focus and handle keys without a hook.

## Layout

`Row` `Column` `Center` `Grid` `Panel` `Divider` `Spacer` `Stack` `ScrollView` `Splitter`

`Panel` is the workhorse and the one that has to look right in all three house styles: it renders its title into the border when it has one, and as a heading row when the theme says `border: none`. `meta` goes to the right of the bottom rule, or of the heading row. A panel also stretches to fill the row it is in, because `Row` centres its children by default and a pane floating in the middle of a taller neighbour is nobody's intent.

## Display

`Heading` `Label` `Badge` `StatusDot` `Card` `KeyValue` `Timeline`

`StatusDot` is the shared status vocabulary. A status is a glyph *and* a colour, because a 16-colour session, a colourblind reader and a piped log all lose the colour and keep the glyph.

## Controls

`Button` `Checkbox` `Switch` `RadioGroup` `Slider` `TextInput` `Select` `SearchBox`

Every one is focusable and states its own focus ring. A terminal has no hover to fall back on: if the focused control is not obvious, the interface is unusable.

`TextInput` publishes a real cursor position when the terminal has a cursor, so the caret is where typing lands rather than a drawn approximation - counting the label and the search glyph before it, and scrolling the value sideways to keep the caret in view. `hideLabel` keeps the label as the field's accessible name without drawing it inside the field, for a form or a dialog that already shows it.

`Button` **inverts when it is selected**: a line and a label in its tone at rest, and when focused the tone becomes the background and the label flips to the colour the theme writes on that tone. Recolouring only the border was too quiet to find, and next to a filled button it read backwards - the filled one looked selected however hard the border tried.

Variants change how a button looks, never how much room it takes: `solid` reserves the same ring `outline` draws and fills it, so a dialog's OK and Cancel sit on the same line whichever way round they are. `ghost` and `link` are text, and stay one row. `Badge` is inline and stays one row too, which is why its `outline` variant is brackets rather than a box.

## Forms

`Form` `Field` `FormSection` `FormActions` `DangerZone`, plus `useForm`, `validators` and `fieldValidators`.

Validation runs over a whole values object rather than per field, because the rules people actually need are cross-field:

```tsx
const form = useForm({
  initialValues: { password: '', confirm: '' },
  validate: (values) => {
    const errors = fieldValidators({ password: [validators.minLength(8)] })(values);
    if (values.confirm !== values.password) errors.confirm = 'Passwords do not match';
    return errors;
  },
  onSubmit: (values) => save(values),
});
```

Errors show only after a field is touched, or after a submit attempt. The initial values are validated immediately, so `form.valid` is usable for enabling a submit button from the first frame.

## Data

`List` `Table` `Tree` `Pagination` `LogViewer` `CodeViewer`

`Table` is responsive by column priority, not by squeezing: as it narrows it drops the lowest-priority column and never the first one, because a row you cannot identify is not a smaller row. A column with no stated priority inherits its position, so it never ties with one explicitly marked unimportant.

`LogViewer` follows the tail until the reader scrolls, then stops - the one behaviour that separates a log you can read from one that yanks itself away.

`CodeViewer` is a viewport, not a column of lines: it renders the rows it was laid out into, scrolls with the keyboard and the wheel, slices each line to the visible columns rather than claiming the width of the longest one, expands tabs to real tab stops, and colours itself by asking the highlighter registry what opens the kind it was given. Opening a ten-thousand-line file costs what opening a ten-line one costs.

### How much do these draw?

All five take `visibleRows`, and none of them need it:

- Given `flex`, a `height`, a `maxHeight` or a `basis`, a data component renders **what fits** and scrolls, because in that case the layout decided its size and `useMeasure` reports it.
- Given none of those, it renders **everything** and its box grows, because then it is the content that decides - and clamping to a measurement would freeze a tree at whatever size it had when it was first drawn.

Which you get is decided by the props you pass, so a pane in a fixed frame scrolls and a small list in a document flows. State `visibleRows` only to override both.

## Navigation and chrome

`Tabs` `Breadcrumb` `Menu` `StatusBar` `Toolbar` `KeyHints` `Wizard`

`StatusBar` takes `leading` and `trailing` rather than `left` and `right`, because those are style props on every node.

## Overlays

`Dialog` `PromptDialog` `Tooltip` `Toast` `ToastHost` `CommandPalette`, plus the `confirm` and `prompt` helpers.

Every one is an entry on a layer rather than a component that draws over its neighbours, so focus trapping, dismissal and paint order are decided once. A dialog can be composed by hand out of public components, and the common case is one line:

```ts
if (await confirm(app.layers, { message: 'Restart billing-worker?', tone: 'danger' })) {
  await app.execute('service.restart', { id: 'billing' });
}
```

`CommandPalette` searches the command registry rather than a list someone maintains, so a command registered anywhere is reachable the moment it exists.

## Charts

`Sparkline` `BarChart` `LineChart` `AreaChart` `Histogram` `Gauge` `Heatmap`

A terminal has one cell of resolution, so these subdivide a cell rather than pretending at pixels: eight block levels for bars and sparklines, a 2×4 braille grid for line and area plots - a 40×8 chart really has 80×32 plot positions. When braille is unavailable the plot falls back to block levels and still reads.

Every chart states its numbers as well as its shape. A shape without a scale is decoration.

## Surfaces and shells

`SurfaceArea` `MountView`, the layouts (`TabsLayout`, `StackLayout`, `SplitLayout`, `BarLayout`, `RailLayout`, `SingleLayout`, `InlineLayout`), and the shells (`PlainShell`, `ConsoleShell`, `PaperShell`, `WorkbenchShell`).

## Resources

`ResourceExplorer` `ResourceView` `MarkdownViewer` `TextViewer` `FallbackViewer` `ResourceActions` `ResourceOpenWith` `ResourceBreadcrumb`

`JsonViewer` and `JsonTreeViewer` ship with the JSON adapter rather than the catalog, and are registered only when an application asks for it with `app.registerAdapter(jsonAdapter())`.

`ResourceView` takes an optional `viewerId`, which is what a screen passes when the reader has chosen among the viewers `viewersFor(kind)` offers - `ResourceOpenWith` renders exactly that list.

See [`resources.md`](resources.md) and [`syntax.md`](syntax.md).

## When it does not fit

Two rules, and they differ by axis because terminals do:

- **Elastic before rigid.** A child with `flex` gives way first, weighted by how big it is. A header, a status bar and a fixed-width sidebar keep their size while the pane that asked to grow pays for the shortfall.
- **Sideways it shrinks; downwards it clips.** In a row, a rigid child narrows and its text truncates, which is how terminals have always narrowed. In a column it keeps its height and the overflow is cut, because a panel below the fold is readable and a panel with no bottom border is not.

`shrink` overrides both, in either direction. Nothing is ever placed outside its container: a child that cannot fit is clipped to what remains, so a component measuring itself always sees a size the terminal actually has.

## Writing one

A component is a function that returns nodes. Give it a name so the registry and the inspector can talk about it:

```tsx
import { defineComponent, useTheme, type BoxProps } from '@textui/core';

export interface ServerStatusProps extends BoxProps {
  status: 'up' | 'down';
}

export const ServerStatus = defineComponent<ServerStatusProps>('ServerStatus', ({ status, ...rest }) => {
  const theme = useTheme();
  return (
    <box role="status" direction="row" gap={1} {...rest}>
      <text content={status === 'up' ? theme.glyphs.bulletFilled : theme.glyphs.bulletHollow}
            fg={status === 'up' ? 'success' : 'danger'} />
      <text content={status} />
    </box>
  );
});
```

Then register it, so a graph can name it:

```ts
app.components.register({
  component: 'ServerStatus',
  category: 'display',
  role: 'status',
  renderer: { kind: 'function', render: ServerStatus },
});
```

Three rules, learned the hard way:

- **Ask the theme for glyphs.** Hardcoding `'●'` is how an ascii terminal ends up with a question mark.
- **Set `role` on the node you render**, not only in the registration - the inspector and the test harness read the node.
- **Namespace anything an application owns** (`Advisor.ServerStatus`). The registry is flat and shared.

A component can also be registered as `{ kind: 'lazy', load }` - the catalog then costs a name until something mounts it - or as `{ kind: 'template' }`, a component defined as data all the way down.
