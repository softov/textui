import type { BoxProps } from '@textui/core';
import {
  defineComponent,
  h,
  nameOf,
  useEffect,
  useInput,
  useRuntime,
  useState,
  useTheme,
} from '@textui/core';
import { TextInput } from '../control/index.js';
import type { MenuItem } from '../navigation/index.js';
import { Menu } from '../navigation/index.js';
import { hint } from './shared.js';

export interface PathPickerProps extends BoxProps {
  start: string;
  wants?: 'file' | 'directory';
  title?: string;
  placeholder?: string;
  visibleRows?: number;
  onPick?(uri: string): void;
  onCancel?(): void;
}

/** The parent of a directory URI, or null at the top of its scheme. */
export function parentOf(uri: string): string | null {
  const at = uri.lastIndexOf('/');
  if (at < 0) return null;
  const head = uri.slice(0, at);
  // `scheme://` is a root, not a parent: trimming again would produce
  // `scheme:/` and then `scheme:`, which are two URIs nothing can list.
  if (head.endsWith('/') || head.endsWith(':')) return null;
  return head;
}

export const PathPicker = defineComponent<PathPickerProps>('PathPicker', (props) => {
  const {
    start, wants = 'file', title, placeholder, visibleRows = 10,
    width = 60, onPick, onCancel, ...rest
  } = props;
  const theme = useTheme();
  const runtime = useRuntime();
  const app = runtime.app();

  const [at, setAt] = useState(start);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [entries, setEntries] = useState<{ uri: string; name: string; directory: boolean }[]>([]);
  /*
   * An empty folder and a folder still being read are different answers.
   *
   * "Nothing here" under a list that has not arrived is a lie the reader acts
   * on - they press escape and go somewhere else. So the list says which.
   */
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    void (async () => {
      const found = await app?.resources.list(at).catch(() => []) ?? [];
      if (!live) return;
      setEntries(found.map((r) => ({
        uri: r.uri,
        name: r.metadata.name || nameOf(r.uri),
        directory: r.capabilities.includes('list'),
      })));
      setLoading(false);
    })();
    return () => { live = false; };
  }, [at]);

  const parent = parentOf(at);
  const q = query.trim().toLowerCase();
  const shown = entries
    // A folder cannot be *chosen* when a file is wanted, but it still has to
    // be walked through - so both kinds are listed either way, and only what
    // enter does about them differs.
    .filter((e) => q === '' || e.name.toLowerCase().includes(q))
    // Folders first, then by name: a list sorted only by name buries the way
    // onward among the things at the end of the journey.
    .sort((a, b) => (a.directory === b.directory
      ? a.name.localeCompare(b.name)
      : (a.directory ? -1 : 1)));

  const rows: MenuItem[] = [
    // Picking the folder you are standing in needs a row, because there is no
    // child to press enter on and a hidden chord for it is a chord nobody
    // finds. It is first, since it is the answer most often wanted.
    ...(wants === 'directory'
      ? [{ id: '.', label: 'Use this folder', icon: theme.glyphs.check }]
      : []),
    ...(parent !== null ? [{ id: '..', label: '..', icon: theme.glyphs.chevronUp }] : []),
    ...shown.map((e) => ({
      id: e.uri,
      label: e.name,
      icon: e.directory ? theme.glyphs.chevronRight : ' ',
      ...(e.directory ? {} : { description: '' }),
    })),
  ];

  const index = Math.max(0, Math.min(highlight, rows.length - 1));

  const up = (): void => {
    if (parent === null) return;
    setAt(parent);
    setQuery('');
    setHighlight(0);
  };

  const choose = (id?: string): void => {
    const chosen = id ?? rows[index]?.id;
    if (chosen === undefined) return;
    if (chosen === '.') { onPick?.(at); return; }
    if (chosen === '..') { up(); return; }
    const entry = entries.find((e) => e.uri === chosen);
    if (!entry) return;
    // A directory is a place to go when a file is wanted, and both a place to
    // go and an answer when one is not - which is why enter descends and the
    // row above is what picks.
    if (entry.directory) { setAt(entry.uri); setQuery(''); setHighlight(0); return; }
    if (wants === 'file') onPick?.(entry.uri);
  };

  useInput((event) => {
    const wrap = (n: number): number => (rows.length === 0
      ? 0
      : ((n % rows.length) + rows.length) % rows.length);
    if (event.name === 'up') { setHighlight(wrap(index - 1)); return true; }
    if (event.name === 'down') { setHighlight(wrap(index + 1)); return true; }
    // Only when a caller gave one. `pick` mounts this on a dismissible layer
    // and the layer closes itself on escape, so taking the key unconditionally
    // would swallow escape for a caller that mounted the picker plainly and
    // wired nothing to it.
    if (event.name === 'escape' && onCancel) { onCancel(); return true; }
    return false;
  }, { global: true });


  const move = `${theme.glyphs.arrowUp}${theme.glyphs.arrowDown} move`;

  return h('box', {
    role: 'dialog',
    label: title ?? 'Choose',
    border: theme.border,
    bg: 'overlay',
    width,
    direction: 'column',
    ...(theme.border === 'none' ? { padding: { left: 1, right: 1 } } : {}),
    title: ` ${title ?? (wants === 'directory' ? 'choose a folder' : 'choose a file')} `,
    ...rest,
  },
    // Where you are. A column of bare names with no header is a list you can
    // get lost in - and the tail is the part that changes, so it is the part
    // kept when the path is too long for the dialog.
    h('text', { content: at, fg: 'muted', truncate: 'start' }),
    h(TextInput, {
      value: query,
      onChange: (next: string) => { setQuery(next); setHighlight(0); },
      onSubmit: () => choose(),
      /*
       * Leftwards is upwards, the way it is in every tree.
       *
       * Through `onEdge` rather than a key handler beside the others: the
       * field has the keyboard, and it answers `left` itself until the caret
       * runs out of text. A global handler for it never fires - the field
       * reports the edge instead, which is the hook that exists for exactly
       * this. It also means a typed filter keeps its own arrows, which is
       * what you want while editing one.
       */
      onEdge: (edge: 'start' | 'end') => { if (edge === 'start') up(); },
      placeholder: placeholder ?? `Filter${theme.glyphs.ellipsis}`,
      search: true,
      autoFocus: true,
      border: 'none',
    }),
    h('box', { height: 1, fill: theme.borderChars().top, fg: 'borderSubtle' }),
    h(Menu, {
      items: rows,
      visibleRows,
      interactive: false,
      activeId: rows[index]?.id,
      onSelect: (id: string) => { choose(id); },
    }),
    /*
     * An empty folder and a folder still being read are different answers.
     *
     * "Nothing here" under a list that has not arrived is a lie the reader
     * acts on - they press escape and go somewhere else. It is a line of its
     * own rather than the menu's empty state because the menu is never empty:
     * `..` and "Use this folder" are rows, and neither is a child.
     */
    shown.length === 0
      ? h('text', {
          content: loading
            ? `Reading${theme.glyphs.ellipsis}`
            : (q === '' ? 'Nothing here.' : 'Nothing matches.'),
          fg: 'muted',
        })
      : null,
    h('box', { height: 1, fill: theme.borderChars().top, fg: 'borderSubtle' }),
    h('text', {
      content: hint(theme, [
        move,
        wants === 'directory' ? 'enter open' : 'enter choose',
        `${theme.glyphs.chevronLeft} up`,
        'esc cancel',
      ]),
      fg: 'subtle',
      truncate: 'end',
    }),
  );
});
