import type { BoxProps, ComponentDefinition, RenderOutput, SemanticVariant } from '@textui/core';
import {
  chorded,
  defineComponent,
  fitTo,
  h,
  stringWidth,
  useFocus,
  useInput,
  useMeasure,
  useState,
  useTheme,
} from '@textui/core';
import { EmptyState } from '../display/index.js';
import { TONE } from '../tone.js';
import { viewportRows } from '../viewport.js';
import { CodeViewer } from './code-viewer.js';
import { Feed } from './feed.js';
import { List } from './list.js';
import { LogViewer } from './log-viewer.js';
import { MarkdownView } from './markdown-view.js';
import { Pagination } from './pagination.js';
import { Tree } from './tree.js';

/**
 * Lists, tables and trees.
 *
 * These are the components that own real interaction state - selection,
 * keyboard navigation, scrolling - so they are the ones where a controlled and
 * an uncontrolled mode both have to work. The rule throughout: if the caller
 * passes the value, the caller owns it; otherwise the component keeps it.
 */
export * from './code-viewer.js';
export * from './feed.js';
export * from './list.js';
export * from './log-viewer.js';
export * from './markdown-view.js';
export * from './pagination.js';
export * from './scroll-thumb.js';
export * from './tree.js';

export interface TableColumn<T extends object = Record<string, unknown>> {
  key: string;
  header: string;
  /** Fixed cell width. Omit to size from the content. */
  width?: number;
  align?: 'left' | 'center' | 'right';
  /** Lower priority columns are dropped first as the table narrows. */
  priority?: number;
  /** Render a cell to a string. Defaults to `String(row[key])`. */
  format?(value: unknown, row: T): string;
  tone?(value: unknown, row: T): SemanticVariant | undefined;
  /** Take the whole remaining width. At most one column should. */
  flex?: boolean;
}

export interface TableProps<T extends object = Record<string, unknown>> extends BoxProps {
  columns: TableColumn<T>[];
  rows: T[];
  /** Field used as the row key. Defaults to `id`. */
  rowKey?: string;
  selectedKey?: string;
  onSelect?(key: string, row: T): void;
  onActivate?(key: string, row: T): void;
  visibleRows?: number;
  showHeader?: boolean;
  emptyMessage?: string;
  focusable?: boolean;
  /** Width below which low-priority columns start being dropped. */
  responsive?: boolean;
}

/**
 * A data table.
 *
 * Responsiveness is a column-priority problem, not a font-size problem: as the
 * table narrows it drops the lowest-priority columns rather than squeezing
 * every column until none of them is readable.
 */
const TableImpl = defineComponent<TableProps<Record<string, unknown>>>('Table', (props) => {
  const theme = useTheme();
  const {
    columns, rows, rowKey = 'id', selectedKey, onSelect, onActivate,
    visibleRows, showHeader = true, emptyMessage = 'No rows',
    focusable = true, responsive = true, width, ...rest
  } = props;

  const focus = useFocus({ disabled: !focusable });
  const measured = useMeasure();
  const [internalKey, setInternalKey] = useState<string | null>(null);
  const keyOf = (row: Record<string, unknown>): string => String(row[rowKey] ?? '');

  // The header is a row of the pane too, so it comes out of the body's share.
  const bodyRows = viewportRows(props, measured, rows.length, {
    requested: visibleRows,
    reserved: showHeader ? 1 : 0,
  });
  const pageSize = bodyRows;

  const currentKey = selectedKey ?? internalKey ?? (rows[0] ? keyOf(rows[0]) : null);
  const index = Math.max(0, rows.findIndex((r) => keyOf(r) === currentKey));

  const select = (next: number): void => {
    const row = rows[Math.max(0, Math.min(rows.length - 1, next))];
    if (!row) return;
    if (selectedKey === undefined) setInternalKey(keyOf(row));
    onSelect?.(keyOf(row), row);
  };

  useInput(
    (event) => {
      if (rows.length === 0 || chorded(event)) return false;
      switch (event.name) {
        case 'up': select(index - 1); return true;
        case 'down': select(index + 1); return true;
        case 'home': select(0); return true;
        case 'end': select(rows.length - 1); return true;
        case 'pageup': select(index - pageSize); return true;
        case 'pagedown': select(index + pageSize); return true;
        case 'enter': {
          const row = rows[index];
          if (row) onActivate?.(keyOf(row), row);
          return true;
        }
        default: return false;
      }
    },
    { focusId: focus.id, enabled: focusable },
  );

  if (rows.length === 0) return h(EmptyState, { title: emptyMessage, ...rest });

  // Column widths: fixed where stated, else the widest cell, capped.
  const columnWidths = columns.map((col) => {
    if (col.width !== undefined) return col.width;
    const header = showHeader ? stringWidth(col.header) : 0;
    const cells = rows.map((row) => {
      const value = (row as Record<string, unknown>)[col.key];
      return stringWidth(col.format ? col.format(value, row) : String(value ?? ''));
    });
    return Math.max(header, ...cells, 1);
  });

  const gap = theme.density === 'compact' ? 1 : 2;
  const available = typeof width === 'number' ? width : Infinity;

  // Drop the lowest-priority columns until what remains fits.
  //
  // Two rules keep this from making a table worse. A column that states no
  // priority inherits its position - earlier columns matter more - so an
  // unstated column never ties with one explicitly marked unimportant. And the
  // first column is never dropped: it is what identifies the row, and a table
  // of measurements with nothing to attach them to is not a smaller table, it
  // is a useless one.
  let shown = columns.map((col, i) => ({
    col,
    width: columnWidths[i] as number,
    priority: col.priority ?? columns.length - i,
    index: i,
  }));

  if (responsive && Number.isFinite(available)) {
    const total = (): number =>
      shown.reduce((sum, c) => sum + c.width, 0) + gap * Math.max(0, shown.length - 1);

    while (total() > available && shown.length > 1) {
      let worstAt = -1;
      let worst = Infinity;
      // Skip index 0, and prefer the rightmost on a tie.
      for (let i = 1; i < shown.length; i++) {
        const p = (shown[i] as { priority: number }).priority;
        if (p <= worst) { worst = p; worstAt = i; }
      }
      if (worstAt === -1) break;
      shown = shown.filter((_, i) => i !== worstAt);
    }
  }

  const rowsWindow = (): { row: Record<string, unknown>; key: string }[] => {
    const all = rows.map((row) => ({ row: row as Record<string, unknown>, key: keyOf(row) }));
    if (all.length <= bodyRows) return all;
    const start = Math.max(0, Math.min(index - Math.floor(bodyRows / 2), all.length - bodyRows));
    return all.slice(start, start + bodyRows);
  };

  const cell = (text: string, entry: { col: TableColumn; width: number }, tone?: SemanticVariant): unknown =>
    h('box', { key: entry.col.key, width: entry.col.flex ? undefined : entry.width, flex: entry.col.flex ? 1 : undefined },
      h('text', {
        content: fitTo(text, entry.width, entry.col.align ?? 'left'),
        fg: tone ? TONE[tone] : undefined,
        truncate: 'end',
      }));

  return h('box', { id: focus.id, role: 'table', direction: 'column', width, ...rest },
    showHeader
      ? h('box', { role: 'row', direction: 'row', gap, dim: true },
          ...shown.map((entry) =>
            h('box', { key: entry.col.key, width: entry.col.flex ? undefined : entry.width, flex: entry.col.flex ? 1 : undefined, role: 'columnheader' },
              h('text', { content: fitTo(entry.col.header, entry.width, entry.col.align ?? 'left') }))))
      : null,

    ...rowsWindow().map(({ row, key }) => {
      const active = key === currentKey;
      return h('box', {
        key,
        role: 'row',
        selected: active,
        direction: 'row',
        gap,
        bg: active && focus.focused ? 'selected' : active ? 'active' : undefined,
        fg: active && focus.focused ? 'inverted' : undefined,
        onClick: () => {
          if (selectedKey === undefined) setInternalKey(key);
          onSelect?.(key, row);
        },
      },
        ...shown.map((entry) => {
          const value = row[entry.col.key];
          const text = entry.col.format ? entry.col.format(value, row) : String(value ?? '');
          return cell(text, entry, entry.col.tone?.(value, row));
        }),
      );
    }),
  );
});

/**
 * Exported with its own generic signature so a caller's row type flows into
 * `format` and `tone` - the alternative is every table taking
 * `Record<string, unknown>` and every cell function starting with a cast.
 */
export const Table = TableImpl as <T extends object>(props: TableProps<T>) => RenderOutput;

export const DATA_COMPONENTS: ComponentDefinition[] = [
  { component: 'List', category: 'data', renderer: { kind: 'function', render: List }, role: 'list', description: 'Selectable rows with keyboard navigation.' },
  { component: 'Table', category: 'data', renderer: { kind: 'function', render: TableImpl }, role: 'table', description: 'Columns that drop by priority as space runs out.' },
  { component: 'Tree', category: 'data', renderer: { kind: 'function', render: Tree }, role: 'tree', description: 'Expandable hierarchy.' },
  { component: 'Pagination', category: 'data', renderer: { kind: 'function', render: Pagination }, description: 'Page of pages.' },
  { component: 'LogViewer', category: 'data', renderer: { kind: 'function', render: LogViewer }, role: 'log', description: 'Streaming lines that follow the tail until you scroll.' },
  { component: 'CodeViewer', category: 'data', renderer: { kind: 'function', render: CodeViewer }, role: 'document', description: 'A scrolling, syntax-coloured file viewer.' },
  { component: 'MarkdownView', category: 'data', renderer: { kind: 'function', render: MarkdownView }, role: 'document', description: 'Markdown drawn into the width it was given. Does not scroll.' },
  { component: 'Feed', category: 'data', renderer: { kind: 'function', render: Feed }, role: 'list', description: 'A viewport over entries of any height, with a cursor and a tail it follows.' },
];
