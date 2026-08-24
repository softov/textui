import type { BoxProps, SemanticVariant } from '@textui/core';
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

export interface ListProps extends BoxProps {
  items: ListItem[];
  selectedId?: string;
  onSelect?(id: string, item: ListItem): void;
  onActivate?(id: string, item: ListItem): void;
  /** Rows visible at once. Scrolls when there are more. */
  visibleRows?: number;
  emptyMessage?: string;
  /** Draw a marker column for the selected row. */
  marker?: boolean;
  focusable?: boolean;
  autoFocus?: boolean;
  /**
   * A stable focus id, so a command - or the screen that owns this - can put
   * the reader here by name. Without one the id comes from the instance, which
   * nothing outside the render can know.
   */
  focusId?: string;
}

export const List = defineComponent<ListProps>('List', (props) => {
  const theme = useTheme();
  const {
    items, selectedId, onSelect, onActivate, visibleRows,
    emptyMessage = 'Nothing here', marker = true, focusable = true,
    autoFocus, focusId, ...rest
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
  const pageSize = viewportRows(props, measured, 10, { requested: visibleRows });
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
  const rows = viewportRows(props, measured, items.length, { requested: visibleRows });
  const start = Math.max(0, Math.min(index - Math.floor(rows / 2), items.length - rows));
  const window = items.slice(start, start + rows);

  return h('box', { id: focus.id, role: 'list', direction: 'column', ...rest },
    ...window.map((item) => {
      const active = item.id === currentId;
      return h('box', {
        key: item.id,
        role: 'listitem',
        label: item.label,
        selected: active,
        direction: 'row',
        gap: 1,
        bg: active && focus.focused ? 'selected' : active ? 'active' : undefined,
        fg: item.disabled ? 'disabled' : active && focus.focused ? 'inverted' : undefined,
        onClick: () => {
          if (item.disabled) return;
          if (selectedId === undefined) setInternalId(item.id);
          onSelect?.(item.id, item);
        },
      },
        marker
          ? h('text', { content: active ? theme.glyphs.chevronRight : ' ' })
          : null,
        item.icon ? h('text', { content: item.icon, fg: item.tone ? TONE[item.tone] : undefined }) : null,
        h('text', { content: item.label, flex: 1, truncate: 'end' }),
        // The secondary columns keep the row's colour once it is selected;
        // `muted` on a selected background is unreadable.
        item.description ? h('text', { content: item.description, fg: active ? undefined : 'muted', truncate: 'end' }) : null,
        item.meta ? h('text', { content: item.meta, fg: active ? undefined : 'muted' }) : null,
      );
    }),
  );
});
