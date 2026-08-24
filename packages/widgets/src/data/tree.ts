import type { BoxProps, SemanticVariant } from '@textui/core';
import {
  chorded,
  defineComponent,
  h,
  useFocus,
  useInput,
  useMeasure,
  useTheme,
} from '@textui/core';
import { usePanelState } from '../panel/index.js';
import { TONE } from '../tone.js';
import { viewportRows } from '../viewport.js';

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
  /**
   * What the expand mark looks like, when a chevron is not what it means.
   *
   * A file tree's twisty is not only "there is more here" - it is also the one
   * thing on the row that says this is a folder, because a folder has no size
   * beside it and nothing else distinguishes it. A caller that knows its rows
   * are folders can say so; everything else gets the theme's chevrons.
   */
  twistyOpen?: string;
  twistyClosed?: string;
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
    visibleRows, indent = 2, twistyOpen, twistyClosed, autoFocus, ...rest
  } = props;

  const focus = useFocus({ autoFocus });
  const measured = useMeasure();
  const treePage = viewportRows(props, measured, 10, { requested: visibleRows });
  /*
   * Uncontrolled expansion belongs to the panel when there is one: a JSON file
   * opened as a structure, switched away from and switched back to, comes back
   * open where it was rather than collapsed to the root. A tree in a sidebar
   * is in no panel and keeps ordinary component state, which is what it had.
   */
  const [treeView, setTreeView] = usePanelState<{ expanded: string[]; selected: string | null }>(
    { expanded: [], selected: null },
  );
  const internalExpanded = treeView.expanded;
  const setInternalExpanded = (next: string[]): void => setTreeView({ expanded: next });
  const internalSelected = treeView.selected;
  const setInternalSelected = (next: string | null): void => setTreeView({ selected: next });

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
      if (!row || chorded(event)) return false;
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

  /*
   * One glyph column, and a second only when something needs both.
   *
   * A row that cannot expand has no twisty, so its icon goes in the twisty's
   * place - otherwise a file sits one column right of a folder at the same
   * depth and reads as being inside it. That was exactly the bug: an explorer
   * that puts the folder glyph *in* the twisty (which is what `twistyClosed`
   * is for) had its files pushed two columns clear of their siblings the
   * moment they grew icons of their own.
   *
   * A second column appears only for a tree where something expandable also
   * has an icon - a chevron *and* a folder mark - and then it is reserved on
   * every row, including the ones that leave it blank, because a column that
   * comes and go by row is the same misalignment wearing a different hat.
   * Measured over every row rather than the visible ones, so scrolling cannot
   * shift the layout under you.
   */
  const iconColumn = rows.some((r) => r.expandable && r.node.icon !== undefined);

  return h('box', { id: focus.id, role: 'tree', direction: 'column', ...rest },
    ...window.map((row) => {
      const active = row.node.id === currentId;
      const twisty = row.expandable
        ? (row.expanded ? (twistyOpen ?? theme.glyphs.chevronDown)
          : (twistyClosed ?? theme.glyphs.chevronRight))
        : (iconColumn ? ' ' : row.node.icon ?? ' ');
      // The marker carries the node's colour only when it *is* the node's
      // icon; a twisty is structure and takes the row's own colour.
      const markerTone = !row.expandable && !iconColumn && row.node.tone !== undefined
        ? TONE[row.node.tone]
        : undefined;

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
        h('text', {
          content: ' '.repeat(row.depth * indent) + twisty,
          ...(markerTone !== undefined && !(active && focus.focused) ? { fg: markerTone } : {}),
        }),
        iconColumn
          ? h('text', {
              content: row.node.icon ?? ' ',
              ...(row.node.tone !== undefined ? { fg: TONE[row.node.tone] } : {}),
            })
          : null,
        h('text', { content: row.node.label, flex: 1, truncate: 'end' }),
        row.node.meta ? h('text', { content: row.node.meta, fg: active ? undefined : 'muted' }) : null,
      );
    }),
  );
});
