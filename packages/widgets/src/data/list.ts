import type { BoxProps, RenderOutput, SemanticVariant } from '@textui/core';
import {
  chorded,
  defineComponent,
  h,
  useFocus,
  useInput,
  useMeasure,
  useState,
  useTheme,
} from '@textui/core';
import { EmptyState } from '../display/index.js';
import { TONE } from '../tone.js';
import { viewportRows } from '../viewport.js';


export interface ListItem {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  tone?: SemanticVariant;
  meta?: string;
  disabled?: boolean;
}

/** How a row stands at the moment it is asked to draw itself. */
export interface ListItemState {
  /** The row the selection is on. */
  selected: boolean;
  /**
   * ...and the list itself has the keyboard.
   *
   * Both, and not one: a selected row in a list that has lost focus is a
   * *remembered* choice, and drawing it as loudly as a live one makes two
   * panes look like they both have the cursor.
   */
  focused: boolean;
  disabled: boolean;
}

export interface ListProps<T extends ListItem = ListItem> extends BoxProps {
  /**
   * The rows.
   *
   * `T` is whatever the caller's own row type is, so long as it is a
   * `ListItem` - which is what the built-in row needs and what `id` being the
   * selection's name needs. Passing plain `ListItem`s is the ordinary case and
   * `T` costs nothing there; a caller with a `renderItem` gets its own fields
   * back on the way in rather than a lookup by id.
   */
  items: T[];
  selectedId?: string;
  onSelect?(id: string, item: T): void;
  onActivate?(id: string, item: T): void;
  /** Rows visible at once. Scrolls when there are more. */
  visibleRows?: number;
  emptyMessage?: string;
  /** Draw a marker column for the selected row. Drawn either way. */
  marker?: boolean;
  focusable?: boolean;
  autoFocus?: boolean;
  /**
   * A stable focus id, so a command - or the screen that owns this - can put
   * the reader here by name. Without one the id comes from the instance, which
   * nothing outside the render can know.
   */
  focusId?: string;
  /**
   * Draw one row's contents.
   *
   * The built-in row - icon, title, description, meta, on one line - is the
   * shape most catalogues are, and it is what you get by leaving this alone.
   * The moment a caller wants a different one, the repair is *not* another
   * field on `ListItem` and another flag saying where to put it: that road
   * ends with a component whose props are a small layout language, and it
   * still cannot draw the row after next.
   *
   * So the row is the caller's, and everything a row cannot do for itself
   * stays here: the selection, the keys that move it, the window that scrolls,
   * the highlight, the marker column and the click. `state` is what the row
   * cannot know - whether it is the selected one, and whether that selection
   * is live.
   *
   * A row taller than one line has to say so with `itemHeight`.
   */
  renderItem?(item: T, state: ListItemState): RenderOutput;
  /**
   * Lines one row occupies, when `renderItem` draws more than one.
   *
   * The list scrolls by arithmetic rather than by measurement - it decides how
   * many rows fit *before* anything is drawn, which is the only way a thousand
   * rows cost the same as ten. That arithmetic is in lines, so a row that is
   * two of them has to be declared, not discovered.
   */
  itemHeight?: number;
}

function ListView<T extends ListItem>(props: ListProps<T>): RenderOutput {
  const theme = useTheme();
  const {
    items, selectedId, onSelect, onActivate, visibleRows,
    emptyMessage = 'Nothing here', marker = true, focusable = true,
    autoFocus, focusId, renderItem, itemHeight = 1, ...rest
  } = props;

  const focus = useFocus({
    ...(focusId ? { id: focusId } : {}),
    disabled: !focusable,
    ...(autoFocus ? { autoFocus } : {}),
  });
  const measured = useMeasure();
  const [internalId, setInternalId] = useState<string | null>(
    items.find((i) => !i.disabled)?.id ?? null,
  );
  const currentId = selectedId ?? internalId;

  /**
   * How many *rows* fit, when what was measured is lines.
   *
   * `visibleRows` is already a count of rows, so it stands as given. Anything
   * else comes from the space the list was handed, and a two-line row buys
   * half as many of them.
   */
  const lines = Math.max(1, itemHeight);
  const fit = (content: number): number => {
    if (visibleRows !== undefined) return Math.max(1, visibleRows);
    return Math.max(1, Math.floor(viewportRows(props, measured, content * lines) / lines));
  };
  const pageSize = fit(10);
  const index = Math.max(0, items.findIndex((i) => i.id === currentId));

  /**
   * Move to `target`, skipping past anything unselectable on the way.
   *
   * The direction has to be given rather than inferred, because `home` and
   * `end` land on an index without coming from one. Stopping at a disabled row
   * instead of stepping over it makes a heading into a wall - which is what a
   * grouped list is made of, so it could not be built at all.
   */
  const selectAt = (target: number, direction: 1 | -1): void => {
    let i = Math.max(0, Math.min(items.length - 1, target));
    while (i >= 0 && i < items.length && items[i]?.disabled === true) i += direction;
    const item = items[i];
    if (!item) return;
    if (selectedId === undefined) setInternalId(item.id);
    onSelect?.(item.id, item);
  };

  useInput(
    (event) => {
      if (items.length === 0 || chorded(event)) return false;
      switch (event.name) {
        case 'up': selectAt(index - 1, -1); return true;
        case 'down': selectAt(index + 1, 1); return true;
        case 'home': selectAt(0, 1); return true;
        case 'end': selectAt(items.length - 1, -1); return true;
        case 'pageup': selectAt(index - pageSize, -1); return true;
        case 'pagedown': selectAt(index + pageSize, 1); return true;
        case 'enter': {
          const item = items[index];
          if (item && item.disabled !== true) onActivate?.(item.id, item);
          return true;
        }
        default: return false;
      }
    },
    { focusId: focus.id, enabled: focusable },
  );

  if (items.length === 0) {
    return h(EmptyState, { title: emptyMessage, ...rest });
  }

  // Keep the selection in view without moving it more than necessary.
  //
  // Unstated, the row count comes from the space the list was given rather
  // than from how many items it holds - a thousand-row list must not decide
  // how tall its own pane is.
  const rows = fit(items.length);
  const start = Math.max(0, Math.min(index - Math.floor(rows / 2), items.length - rows));
  const window = items.slice(start, start + rows);

  return h('box', { id: focus.id, role: 'list', direction: 'column', ...rest },
    ...window.map((item) => {
      const active = item.id === currentId;
      const state: ListItemState = {
        selected: active,
        focused: focus.focused,
        disabled: item.disabled === true,
      };
      // `item.id` is the key as well as the selection's name, and deliberately
      // the same string: a row that reconciled under one identity while the
      // selection pointed at another would be a highlight on the wrong row,
      // and no amount of looking at either one would show why.
      return h('box', {
        key: item.id,
        role: 'listitem',
        label: item.label,
        selected: active,
        direction: 'row',
        gap: 1,
        // One background over the whole row, however many lines it draws: a
        // highlight that stopped after the first would split the row it is
        // highlighting in two.
        bg: active && focus.focused ? 'selected' : active ? 'active' : undefined,
        fg: item.disabled ? 'disabled' : active && focus.focused ? 'inverted' : undefined,
        onClick: () => {
          if (item.disabled) return;
          if (selectedId === undefined) setInternalId(item.id);
          onSelect?.(item.id, item);
        },
      },
        // The marker stays here even when the contents are the caller's. It
        // belongs to the selection rather than to the row, and a column that
        // every row has to remember to draw is a column that goes crooked.
        marker
          ? h('text', { content: active ? theme.glyphs.chevronRight : ' ', shrink: 0 })
          : null,
        ...(renderItem
          ? [h('box', { direction: 'column', flex: 1 }, renderItem(item, state))]
          : defaultRow(item, active)),
      );
    }),
  );
}

export const List = defineComponent('List', ListView as (props: ListProps) => RenderOutput) as typeof ListView;

/**
 * The row you get for free: an icon, a title, an elaboration, a state.
 *
 * One line, because a list of a thousand of them has to cost what a list of
 * ten does, and because most catalogues are exactly this. Anything else is
 * `renderItem`.
 */
function defaultRow(item: ListItem, active: boolean): RenderOutput[] {
  return [
    item.icon ? h('text', { content: item.icon, fg: item.tone ? TONE[item.tone] : undefined }) : null,
    h('text', { content: item.label, flex: 1, truncate: 'end' }),
    // The secondary columns keep the row's colour once it is selected;
    // `muted` on a selected background is unreadable.
    //
    // The description yields first, and by a lot: it is the elaboration,
    // and a row reading "brb_fram…" beside a status cut to "waiting on y…"
    // has spent the width on the wrong two things. `meta` gives up none of
    // it - a status is three words at most, and it is the column the row
    // is being scanned for.
    item.description
      ? h('text', { content: item.description, fg: active ? undefined : 'muted', truncate: 'end', shrink: 8 })
      : null,
    item.meta
      ? h('text', { content: item.meta, fg: active ? undefined : 'muted', shrink: 0 })
      : null,
  ] as RenderOutput[];
}
