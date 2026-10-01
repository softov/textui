import type { BoxProps, RenderOutput } from '@textui/core';
import { defineComponent, stringWidth, useMeasure, useSize } from '@textui/core';
import type { ListItem, ListItemState } from '@textui/widgets';
import { List, Row } from '@textui/widgets';

/**
 * The least of a row the description is left, in cells.
 *
 * The name column is the one that can always give ground - a name cut short is
 * still recognisable and the description is how a person tells two similarly
 * named skills apart. So the column stops growing this far from the source
 * column, and a name past it is cut with the theme's own ellipsis.
 */
const DESCRIPTION_FLOOR = 16;

/**
 * The name column when the caller states nothing.
 *
 * Wide enough for the names skills tend to have (`/security-review`,
 * `/team-onboarding`) without spending a wide terminal on the column. A longer
 * name widens it; this is a floor, not a cut.
 */
const COMMAND_WIDTH = 20;

/**
 * One command in the completion menu.
 *
 * The three cells a row is made of, and nothing else: the menu's own frame,
 * the selection and the keys are the list's. `List`'s row type is reused so a
 * caller can hand these straight to either.
 */
export interface CommandItem extends ListItem {
  /** What it does. One line, or as many as `descriptionLines` allows. */
  description?: string;
  /** Where it came from, or its title. Pinned to the right. */
  meta?: string;
}

export interface CommandListProps extends BoxProps {
  items: CommandItem[];
  selectedId?: string;
  /** The least the name column gets. A longer name widens it. */
  commandWidth?: number;
  /**
   * Lines a description may occupy. One by default.
   *
   * Read with `wrapDescription`: unwrapped, a description is one line however
   * many are allowed, because the rest would be empty rows.
   */
  descriptionLines?: number;
  /**
   * Whether a description wraps into those lines or is cut on the first.
   *
   * Wrapped, the row is as tall as `descriptionLines` and the cut carries the
   * theme's ellipsis when the text still does not fit. Unwrapped, every row is
   * one line and a long description is cut with the same ellipsis.
   */
  wrapDescription?: boolean;
  /**
   * Lines the menu may occupy here, which decides how many rows fit.
   *
   * A row is `descriptionLines` tall when descriptions wrap, so the same space
   * holds proportionally fewer of them. Left out, the list measures its own
   * box.
   */
  availableLines?: number;
  /** Draw the marker column for the selected row. Off unless asked for. */
  marker?: boolean;
  /** The list's own keyboard. A completion menu is driven by its field. */
  focusable?: boolean;
  emptyMessage?: string;
  onSelect?(id: string, item: CommandItem): void;
  onActivate?(id: string, item: CommandItem): void;
}

/**
 * The completion menu over a composer: a name, what it does, where it came
 * from.
 *
 * Extracted from `ChatComposer` because the rows are the whole of what a menu
 * is, and a caller with a different list of commands - an editor's palette, a
 * plugin's own - should not have to re-derive the column arithmetic. The menu
 * is a table: one width for the name column across every row, measured here
 * rather than per row, so the description starts at the same cell on the row
 * the reader is on and the rows around it.
 *
 * The width comes from this component's own measured box, not the terminal:
 * the menu is as wide as the box it was given, and a composer in a split pane
 * is not the whole screen.
 */
export const CommandList = defineComponent<CommandListProps>('CommandList', (props) => {
  const {
    items, selectedId, commandWidth = COMMAND_WIDTH, descriptionLines = 1,
    wrapDescription = false, availableLines, marker, focusable = false,
    emptyMessage, onSelect, onActivate, ...rest
  } = props;

  // The box this menu was given. `useSize` is the terminal, which is only the
  // same thing while the composer spans it; `useMeasure` is this node. The
  // first frame is measured at zero, so the terminal is the honest stand-in
  // until the layout has run.
  const measured = useMeasure();
  const terminal = useSize();
  const width = measured.width > 0 ? measured.width : Math.max(1, terminal.width - 4);

  /*
   * The name column, one width for the whole menu.
   *
   * The caller's width is a floor and the longest name widens it, because a
   * name cut in half is how two skills come to look alike - but the description
   * is what tells them apart, so the column stops where the description would
   * be left too little. Past that the name is cut, and the cut carries the
   * theme's own ellipsis.
   *
   * The four cells are the marker and its gap, and the two gaps between the
   * row's three cells; the source column is measured because it never gives
   * ground.
   */
  const longest = Math.max(0, ...items.map((item) => stringWidth(item.label)));
  const widestMeta = Math.max(0, ...items.map((item) => stringWidth(item.meta ?? '')));
  const room = width - 4 - widestMeta - DESCRIPTION_FLOOR;
  const nameColumn = Math.max(1, Math.min(Math.max(commandWidth, longest), Math.max(1, room)));

  // A row is as tall as a description is allowed to be, and one line when it
  // may not wrap: the rest would be rows of nothing.
  const lines = wrapDescription ? Math.max(1, descriptionLines) : 1;
  const visibleRows = availableLines === undefined ? undefined : Math.max(1, Math.floor(availableLines / lines));

  return (
    <List
      items={items}
      selectedId={selectedId}
      focusable={focusable}
      itemHeight={lines}
      {...(visibleRows === undefined ? {} : { visibleRows })}
      {...(marker === undefined ? {} : { marker })}
      {...(emptyMessage === undefined ? {} : { emptyMessage })}
      {...(onSelect === undefined ? {} : { onSelect: (id: string, item: CommandItem) => onSelect(id, item) })}
      {...(onActivate === undefined ? {} : { onActivate: (id: string, item: CommandItem) => onActivate(id, item) })}
      renderItem={(item: CommandItem, state: ListItemState): RenderOutput => (
        <Row gap={1} height={lines}>
          <text
            content={item.label}
            width={nameColumn}
            truncate="end"
            shrink={0}
            {...(state.selected ? {} : { fg: 'muted' as const })}
          />
          <text
            content={item.description ?? ''}
            height={lines}
            flex={1}
            {...(wrapDescription ? { wrap: 'word' as const } : { truncate: 'end' as const })}
            {...(state.selected ? {} : { fg: 'muted' as const })}
          />
          {item.meta
            ? <text content={item.meta} shrink={0} {...(state.selected ? {} : { fg: 'muted' as const })} />
            : null}
        </Row>
      )}
      {...rest}
    />
  );
});
