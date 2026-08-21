import type { ComponentDefinition } from '../types/component-registry.js';
import type { BoxProps } from '../jsx/intrinsics.js';
import type { RenderOutput } from '../types/render.js';
import type { SemanticVariant } from '../types/style.js';
import type { SyntaxToken } from '../types/syntax.js';
import type { ResolvedTheme } from '../types/theme.js';
import { h, defineComponent } from '../jsx/factory.js';
import { TONE } from './tone.js';
import {
  useEffect, useFocus, useHighlight, useInput, useMeasure, useMemo, useState, useTheme,
} from '../runtime/hooks.js';
import { expandTabs, fitTo, sliceColumns, stringWidth } from '../util/text.js';
import { viewportRows } from './viewport.js';
import { EmptyState } from './display.js';

/**
 * Lists, tables and trees.
 *
 * These are the components that own real interaction state - selection,
 * keyboard navigation, scrolling - so they are the ones where a controlled and
 * an uncontrolled mode both have to work. The rule throughout: if the caller
 * passes the value, the caller owns it; otherwise the component keeps it.
 */


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
}

export const List = defineComponent<ListProps>('List', (props) => {
  const theme = useTheme();
  const {
    items, selectedId, onSelect, onActivate, visibleRows,
    emptyMessage = 'Nothing here', marker = true, focusable = true, ...rest
  } = props;

  const focus = useFocus({ disabled: !focusable });
  const measured = useMeasure();
  const [internalId, setInternalId] = useState<string | null>(items[0]?.id ?? null);
  const currentId = selectedId ?? internalId;
  const pageSize = viewportRows(props, measured, 10, { requested: visibleRows });
  const index = Math.max(0, items.findIndex((i) => i.id === currentId));

  const select = (next: number): void => {
    const item = items[Math.max(0, Math.min(items.length - 1, next))];
    if (!item || item.disabled) return;
    if (selectedId === undefined) setInternalId(item.id);
    onSelect?.(item.id, item);
  };

  useInput(
    (event) => {
      if (items.length === 0) return false;
      switch (event.name) {
        case 'up': select(index - 1); return true;
        case 'down': select(index + 1); return true;
        case 'home': select(0); return true;
        case 'end': select(items.length - 1); return true;
        case 'pageup': select(index - pageSize); return true;
        case 'pagedown': select(index + pageSize); return true;
        case 'enter': {
          const item = items[index];
          if (item) onActivate?.(item.id, item);
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
      if (rows.length === 0) return false;
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

export interface TreeNode {
  id: string;
  label: string;
  icon?: string;
  children?: TreeNode[];
  /** Children exist but are not loaded yet. */
  hasChildren?: boolean;
  tone?: SemanticVariant;
  meta?: string;
}

export interface TreeProps extends BoxProps {
  nodes: TreeNode[];
  selectedId?: string;
  expandedIds?: string[];
  onSelect?(id: string, node: TreeNode): void;
  onActivate?(id: string, node: TreeNode): void;
  onToggle?(id: string, expanded: boolean): void;
  visibleRows?: number;
  indent?: number;
  /** Claim focus on mount, if nothing in this scope already has it. */
  autoFocus?: boolean;
}

interface FlatNode {
  node: TreeNode;
  depth: number;
  expanded: boolean;
  expandable: boolean;
}

function flatten(nodes: TreeNode[], expanded: Set<string>, depth = 0, out: FlatNode[] = []): FlatNode[] {
  for (const node of nodes) {
    const expandable = Boolean(node.hasChildren || (node.children && node.children.length > 0));
    const isExpanded = expanded.has(node.id);
    out.push({ node, depth, expanded: isExpanded, expandable });
    if (isExpanded && node.children) flatten(node.children, expanded, depth + 1, out);
  }
  return out;
}

export const Tree = defineComponent<TreeProps>('Tree', (props) => {
  const theme = useTheme();
  const {
    nodes, selectedId, expandedIds, onSelect, onActivate, onToggle,
    visibleRows, indent = 2, autoFocus, ...rest
  } = props;

  const focus = useFocus({ autoFocus });
  const measured = useMeasure();
  const treePage = viewportRows(props, measured, 10, { requested: visibleRows });
  const [internalExpanded, setInternalExpanded] = useState<string[]>([]);
  const [internalSelected, setInternalSelected] = useState<string | null>(null);

  const expanded = new Set(expandedIds ?? internalExpanded);
  const rows = flatten(nodes, expanded);
  const currentId = selectedId ?? internalSelected ?? rows[0]?.node.id ?? null;
  const index = Math.max(0, rows.findIndex((r) => r.node.id === currentId));

  const select = (next: number): void => {
    const row = rows[Math.max(0, Math.min(rows.length - 1, next))];
    if (!row) return;
    if (selectedId === undefined) setInternalSelected(row.node.id);
    onSelect?.(row.node.id, row.node);
  };

  const toggle = (id: string, next: boolean): void => {
    if (expandedIds === undefined) {
      setInternalExpanded(next
        ? [...internalExpanded, id]
        : internalExpanded.filter((e) => e !== id));
    }
    onToggle?.(id, next);
  };

  useInput(
    (event) => {
      const row = rows[index];
      if (!row) return false;
      switch (event.name) {
        case 'up': select(index - 1); return true;
        case 'down': select(index + 1); return true;
        case 'pageup': select(index - treePage); return true;
        case 'pagedown': select(index + treePage); return true;
        case 'home': select(0); return true;
        case 'end': select(rows.length - 1); return true;
        case 'right':
          // Right expands, and only moves inward once already expanded.
          if (row.expandable && !row.expanded) toggle(row.node.id, true);
          else select(index + 1);
          return true;
        case 'left':
          if (row.expandable && row.expanded) toggle(row.node.id, false);
          else {
            const parent = rows.slice(0, index).reverse().find((r) => r.depth < row.depth);
            if (parent) select(rows.indexOf(parent));
          }
          return true;
        case 'enter':
          if (row.expandable) toggle(row.node.id, !row.expanded);
          onActivate?.(row.node.id, row.node);
          return true;
        default: return false;
      }
    },
    { focusId: focus.id },
  );

  // As with the list: how many rows fit is a question for the layout, not for
  // the data. A deep tree scrolls inside its pane instead of stretching it.
  const shown = viewportRows(props, measured, rows.length, { requested: visibleRows });
  const window = rows.length <= shown
    ? rows
    : rows.slice(
        Math.max(0, Math.min(index - Math.floor(shown / 2), rows.length - shown)),
        Math.max(0, Math.min(index - Math.floor(shown / 2), rows.length - shown)) + shown,
      );

  return h('box', { id: focus.id, role: 'tree', direction: 'column', ...rest },
    ...window.map((row) => {
      const active = row.node.id === currentId;
      const twisty = row.expandable
        ? (row.expanded ? theme.glyphs.chevronDown : theme.glyphs.chevronRight)
        : ' ';

      return h('box', {
        key: row.node.id,
        role: 'treeitem',
        label: row.node.label,
        selected: active,
        direction: 'row',
        gap: 1,
        bg: active && focus.focused ? 'selected' : active ? 'active' : undefined,
        fg: active && focus.focused ? 'inverted' : undefined,
        onClick: () => {
          if (selectedId === undefined) setInternalSelected(row.node.id);
          onSelect?.(row.node.id, row.node);
        },
      },
        h('text', { content: ' '.repeat(row.depth * indent) + twisty }),
        row.node.icon ? h('text', { content: row.node.icon, fg: row.node.tone ? TONE[row.node.tone] : undefined }) : null,
        h('text', { content: row.node.label, flex: 1, truncate: 'end' }),
        row.node.meta ? h('text', { content: row.node.meta, fg: active ? undefined : 'muted' }) : null,
      );
    }),
  );
});

export interface PaginationProps extends BoxProps {
  page: number;
  pageCount: number;
  total?: number;
  onChange?(page: number): void;
}

export const Pagination = defineComponent<PaginationProps>('Pagination', (props) => {
  const theme = useTheme();
  const { page, pageCount, total, onChange, ...rest } = props;
  const focus = useFocus({});

  useInput(
    (event) => {
      if (event.name === 'left' && page > 1) { onChange?.(page - 1); return true; }
      if (event.name === 'right' && page < pageCount) { onChange?.(page + 1); return true; }
      return false;
    },
    { focusId: focus.id },
  );

  return h('box', { id: focus.id, direction: 'row', gap: 1, ...rest },
    h('text', { content: theme.glyphs.chevronLeft, fg: page > 1 ? 'accent' : 'disabled' }),
    h('text', { content: `${page} / ${pageCount}`, bold: focus.focused }),
    h('text', { content: theme.glyphs.chevronRight, fg: page < pageCount ? 'accent' : 'disabled' }),
    total !== undefined ? h('text', { content: `${total} items`, fg: 'muted' }) : null,
  );
});

export interface LogLine {
  time?: string;
  level?: 'debug' | 'info' | 'warn' | 'error';
  source?: string;
  message: string;
}

export interface LogViewerProps extends BoxProps {
  lines: LogLine[];
  /** Rows shown. Older lines scroll off the top. */
  visibleRows?: number;
  /** Stick to the newest line. Turned off when the reader scrolls up. */
  follow?: boolean;
  showTime?: boolean;
  showLevel?: boolean;
  onFollowChange?(follow: boolean): void;
}

const LEVEL_TONE: Record<string, SemanticVariant> = {
  debug: 'muted', info: 'info', warn: 'warning', error: 'danger',
};

/**
 * Streaming text.
 *
 * A log viewer follows the tail until the reader scrolls, then stops - the one
 * behaviour that makes the difference between a log you can read and a log
 * that yanks itself out from under you.
 */
export const LogViewer = defineComponent<LogViewerProps>('LogViewer', (props) => {
  const {
    lines, visibleRows: visibleRowsProp, follow: followProp, showTime = true,
    showLevel = true, onFollowChange, ...rest
  } = props;

  const focus = useFocus({});
  const measured = useMeasure();
  const [offset, setOffset] = useState(0);
  const [following, setFollowing] = useState(followProp ?? true);
  const follow = followProp ?? following;

  // Ten rows was a guess. The pane knows the answer.
  const visibleRows = viewportRows(props, measured, visibleRowsProp ?? 10, {
    requested: visibleRowsProp,
  });
  const maxOffset = Math.max(0, lines.length - visibleRows);
  const top = follow ? maxOffset : Math.min(offset, maxOffset);

  const scroll = (delta: number): void => {
    const next = Math.max(0, Math.min(maxOffset, top + delta));
    setOffset(next);
    const nowFollowing = next >= maxOffset;
    if (followProp === undefined) setFollowing(nowFollowing);
    onFollowChange?.(nowFollowing);
  };

  useInput(
    (event) => {
      switch (event.name) {
        case 'up': scroll(-1); return true;
        case 'down': scroll(1); return true;
        case 'pageup': scroll(-visibleRows); return true;
        case 'pagedown': scroll(visibleRows); return true;
        case 'home': scroll(-lines.length); return true;
        case 'end': scroll(lines.length); return true;
        default: return false;
      }
    },
    { focusId: focus.id },
  );

  const window = lines.slice(top, top + visibleRows);

  return h('box', { id: focus.id, role: 'log', direction: 'column', ...rest },
    ...window.map((line, i) =>
      h('box', { key: top + i, direction: 'row', gap: 1 },
        showTime && line.time ? h('text', { content: line.time, fg: 'subtle' }) : null,
        showLevel && line.level
          ? h('text', {
              content: line.level.toUpperCase().padEnd(5),
              fg: TONE[LEVEL_TONE[line.level] ?? 'muted'],
            })
          : null,
        line.source ? h('text', { content: line.source, fg: 'muted' }) : null,
        h('text', { content: line.message, flex: 1, truncate: 'end' }),
      )),
    !follow
      ? h('text', { content: '  paused - end to follow', fg: 'warning', dim: true })
      : null,
  );
});

export interface CodeViewerProps extends BoxProps {
  content: string;
  /** Show line numbers in a gutter. */
  lineNumbers?: boolean;
  startLine?: number;
  /**
   * Fix the number of rows. Left off, the viewer renders exactly as many rows
   * as it was laid out into - which is what stops a long file from resizing
   * the pane it is shown in.
   */
  visibleRows?: number;
  /** Rows to mark, 1-based. */
  highlight?: number[];
  /** Pre-tokenised content, when the caller has already highlighted it. */
  tokens?: SyntaxToken[][];
  /** Ask the registry for a highlighter by id... */
  language?: string;
  /** ...or by resource kind... */
  kind?: string;
  /** ...or by filename. */
  uri?: string;
  /** Caret line, 1-based. Controlled when passed. */
  line?: number;
  onLineChange?(line: number): void;
  /** Called whenever the caret or the viewport moves. */
  onPosition?(position: CodeViewerPosition): void;
  /** Draw a scrollbar when the content is taller than the view. */
  scrollbar?: boolean;
  /** Mark the caret line. Off for a plain excerpt. */
  showCaret?: boolean;
  tabWidth?: number;
}

export interface CodeViewerPosition {
  /** Caret line, 1-based. */
  line: number;
  /** Leftmost visible column, 0-based. */
  column: number;
  /** First visible line, 1-based. */
  top: number;
  rows: number;
  lines: number;
  /** Longest line, in cells. */
  width: number;
}

const HORIZONTAL_STEP = 4;

/**
 * A file viewer.
 *
 * Two things make this different from a column of `text` nodes. It renders
 * only the rows it was given room for, so opening a ten-thousand-line file
 * costs the same as opening a ten-line one and neither of them moves the panes
 * around it. And it colours by asking the registry for a highlighter, so a new
 * file type arrives coloured without this component learning what it is.
 */
export const CodeViewer = defineComponent<CodeViewerProps>('CodeViewer', (props) => {
  const {
    content, lineNumbers = true, startLine = 1, visibleRows, highlight = [],
    tokens, language, kind, uri, line, onLineChange, onPosition,
    scrollbar = true, showCaret = true, tabWidth = 4, disabled, ...rest
  } = props;

  const theme = useTheme();
  const focus = useFocus({ disabled });
  const measured = useMeasure();

  const text = useMemo(() => expandTabs(content, tabWidth), [content, tabWidth]);
  const lines = useMemo(() => text.split('\n'), [text]);
  const auto = useHighlight(tokens ? '' : text, { language, kind, uri });
  const lineTokens = tokens ?? auto;

  const [top, setTop] = useState(0);
  const [left, setLeft] = useState(0);
  const [internalLine, setInternalLine] = useState(1);

  const rows = viewportRows(props, measured, lines.length, { requested: visibleRows });

  const gutter = lineNumbers ? String(startLine + lines.length - 1).length : 0;
  const bars = scrollbar && lines.length > rows ? 1 : 0;
  const textWidth = Math.max(
    1,
    (measured.width > 0 ? measured.width : 80) - (lineNumbers ? gutter + 1 : 0) - bars,
  );

  const longest = useMemo(
    () => lines.reduce((max, l) => Math.max(max, stringWidth(l)), 0),
    [lines],
  );

  const maxTop = Math.max(0, lines.length - rows);
  const maxLeft = Math.max(0, longest - textWidth);
  const caret = clampLine(line ?? internalLine, lines.length);

  // The caret leads and the viewport follows, so arrowing past the last row
  // scrolls rather than parking the caret out of sight.
  const firstVisible = Math.min(
    Math.max(0, Math.min(top, maxTop)),
    Math.max(0, Math.min(caret - 1, maxTop)),
  );
  const offset = Math.max(firstVisible, Math.min(caret - rows, maxTop));
  const leftColumn = Math.max(0, Math.min(left, maxLeft));

  const moveTo = (next: number): void => {
    const clamped = clampLine(next, lines.length);
    if (line === undefined) setInternalLine(clamped);
    onLineChange?.(clamped);
    if (clamped - 1 < offset) setTop(clamped - 1);
    else if (clamped > offset + rows) setTop(clamped - rows);
  };

  const scrollBy = (delta: number): void => {
    const next = Math.max(0, Math.min(maxTop, offset + delta));
    setTop(next);
    // Keep the caret inside the view, the way a pager does.
    const clamped = clampLine(Math.min(Math.max(caret, next + 1), next + rows), lines.length);
    if (line === undefined) setInternalLine(clamped);
    else onLineChange?.(clamped);
  };

  useInput(
    (event) => {
      if (disabled) return false;
      switch (event.name) {
        case 'up': moveTo(caret - 1); return true;
        case 'down': moveTo(caret + 1); return true;
        case 'pageup': moveTo(caret - rows); return true;
        case 'pagedown': moveTo(caret + rows); return true;
        case 'home': moveTo(1); return true;
        case 'end': moveTo(lines.length); return true;
        case 'left': setLeft(Math.max(0, leftColumn - HORIZONTAL_STEP)); return true;
        case 'right': setLeft(Math.min(maxLeft, leftColumn + HORIZONTAL_STEP)); return true;
        default: return false;
      }
    },
    { focusId: focus.id },
  );

  useEffect(() => {
    onPosition?.({
      line: caret,
      column: leftColumn,
      top: offset + 1,
      rows,
      lines: lines.length,
      width: longest,
    });
  }, [caret, leftColumn, offset, rows, lines.length, longest]);

  const body: RenderOutput[] = [];
  for (let i = 0; i < rows; i++) {
    const index = offset + i;
    if (index >= lines.length) break;

    const number = startLine + index;
    const marked = highlight.includes(number);
    const onCaret = showCaret && focus.focused && number === caret + startLine - 1;

    // No `gap` on this row: the gap would land between every token, not only
    // between the gutter and the code, and space out the source by a cell per
    // token. The gutter carries its own trailing space instead.
    body.push(
      h('box', {
        key: number,
        direction: 'row',
        height: 1,
        bg: marked ? 'active' : onCaret ? 'hover' : undefined,
      },
        lineNumbers
          ? h('text', {
              content: `${String(number).padStart(gutter)} `,
              fg: onCaret || marked ? 'text' : 'subtle',
              width: gutter + 1,
            })
          : null,
        ...spansFor(
          lineTokens[index] ?? [{ text: lines[index] ?? '', scope: 'plain' }],
          leftColumn,
          textWidth,
          theme,
        ),
      ),
    );
  }

  return h('box', {
    id: focus.id,
    role: 'document',
    direction: 'row',
    onMouse: (event: { action: string; wheel?: number }) => {
      if (event.action !== 'wheel') return false;
      scrollBy((event.wheel ?? 0) * 3);
      return true;
    },
    ...rest,
  },
    h('box', { direction: 'column', flex: 1 }, ...body),
    bars
      ? h(ScrollThumb, { total: lines.length, rows, offset, focused: focus.focused })
      : null,
  );
});

function clampLine(line: number, total: number): number {
  return Math.max(1, Math.min(total === 0 ? 1 : total, Math.round(line)));
}

/**
 * One `text` node per token, sliced to the visible columns.
 *
 * Slicing here rather than truncating in the layout is what keeps the viewer
 * from claiming the width of its longest line - which is the horizontal half
 * of the same bug that makes a pane resize when a file is opened.
 */
function spansFor(
  tokens: SyntaxToken[],
  left: number,
  width: number,
  theme: ResolvedTheme,
): RenderOutput[] {
  const out: RenderOutput[] = [];
  let column = 0;
  let drawn = 0;

  for (let i = 0; i < tokens.length && drawn < width; i++) {
    const token = tokens[i] as SyntaxToken;
    const tokenWidth = stringWidth(token.text);
    const end = column + tokenWidth;

    if (end > left) {
      const from = Math.max(0, left - column);
      const slice = sliceColumns(token.text, from, width - drawn);
      if (slice !== '') {
        out.push(h('text', {
          key: i,
          content: slice,
          fg: token.scope === 'plain' ? undefined : theme.syntax[token.scope],
        }));
        drawn += stringWidth(slice);
      }
    }
    column = end;
  }

  // The row must still fill its width, or the caret background stops short of
  // the right edge and the highlight looks ragged.
  if (drawn < width) out.push(h('box', { flex: 1 }));
  return out;
}

const ScrollThumb = defineComponent<{
  total: number;
  rows: number;
  offset: number;
  focused: boolean;
}>('ScrollThumb', ({ total, rows, offset, focused }) => {
  const theme = useTheme();
  // Not border glyphs: `left` and `right` are the same character in every
  // border style, so a thumb drawn with one would be invisible against a
  // track drawn with the other.
  const thumbChar = theme.glyphs.progressFull;
  const trackChar = theme.glyphs.progressEmpty;
  const track = Math.max(1, rows);
  const size = Math.max(1, Math.round((rows / Math.max(1, total)) * track));
  const span = Math.max(0, track - size);
  const position = total <= rows
    ? 0
    : Math.round((offset / Math.max(1, total - rows)) * span);

  const cells: RenderOutput[] = [];
  for (let i = 0; i < track; i++) {
    const onThumb = i >= position && i < position + size;
    cells.push(h('text', {
      key: i,
      content: onThumb ? thumbChar : trackChar,
      fg: onThumb ? (focused ? 'focus' : 'border') : 'borderSubtle',
    }));
  }
  return h('box', { width: 1, direction: 'column' }, ...cells);
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
];
