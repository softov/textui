import type { ComponentDefinition, BoxProps, SemanticVariant, StyleColor } from '@textui/core';
import { h, defineComponent, useFocus, useInput, useState, useTheme } from '@textui/core';
import { TONE } from './tone.js';
import { Marquee } from './display.js';

/**
 * Navigation chrome.
 *
 * These are the components a shell is made of, which is why they all take
 * their own items rather than reading a surface: the same `Tabs` serves a tab
 * strip in a workbench and a segmented control inside a panel.
 */


export interface TabItem {
  id: string;
  label: string;
  icon?: string;
  badge?: string | number;
  disabled?: boolean;
}

export interface TabsProps extends BoxProps {
  items: TabItem[];
  activeId?: string;
  onChange?(id: string): void;
  /** Underline the active tab instead of inverting it. */
  variant?: 'underline' | 'solid' | 'plain';
  separator?: string;
  /** Take focus on mount, so the keyboard has somewhere to be. */
  autoFocus?: boolean;
}

export const Tabs = defineComponent<TabsProps>('Tabs', (props) => {
  const { items, activeId, onChange, variant = 'underline', separator, autoFocus, ...rest } = props;
  const focus = useFocus({ autoFocus });
  const index = Math.max(0, items.findIndex((t) => t.id === activeId));

  useInput(
    (event) => {
      const step = event.name === 'right' ? 1 : event.name === 'left' ? -1 : 0;
      if (step === 0) return false;
      const next = items[(index + step + items.length) % items.length];
      if (next && !next.disabled) onChange?.(next.id);
      return true;
    },
    { focusId: focus.id },
  );

  const gap = separator ? 0 : 1;

  return h('box', { id: focus.id, role: 'tablist', direction: 'row', gap, ...rest },
    ...items.flatMap((item, i) => {
      const active = item.id === activeId;
      const tab = h('box', {
        key: item.id,
        role: 'tab',
        label: item.label,
        selected: active,
        direction: 'row',
        gap: 1,
        padding: variant === 'solid' ? [0, 1] : 0,
        bg: variant === 'solid' && active ? 'selected' : undefined,
        fg: item.disabled ? 'disabled' : active ? (variant === 'solid' ? 'inverted' : 'accent') : 'muted',
        bold: active,
        underline: variant === 'underline' && active,
        onClick: () => { if (!item.disabled) onChange?.(item.id); },
      },
        item.icon ? h('text', { content: item.icon }) : null,
        h('text', { content: item.label }),
        item.badge !== undefined
          // No colour of its own on the active tab: `muted` against the
          // selected background is the one pairing that never reads.
          ? h('text', { content: String(item.badge), fg: active ? undefined : 'muted' })
          : null,
      );

      return separator && i < items.length - 1
        ? [tab, h('text', { key: `${item.id}-sep`, content: separator, fg: 'borderSubtle' })]
        : [tab];
    }),
  );
});

export interface BreadcrumbProps extends BoxProps {
  items: { id: string; label: string; icon?: string }[];
  onSelect?(id: string): void;
  separator?: string;
  /** Collapse the middle when it does not fit. */
  maxItems?: number;
}

export const Breadcrumb = defineComponent<BreadcrumbProps>('Breadcrumb', (props) => {
  const theme = useTheme();
  const { items, onSelect, separator, maxItems, ...rest } = props;
  const sep = separator ?? theme.glyphs.breadcrumb;


  // Keep the root and the tail; the middle is what a reader needs least.
  type Crumb = { id: string; label: string; icon?: string };
  const shown: Crumb[] = maxItems && items.length > maxItems
    ? [
        items[0] as Crumb,
        { id: '__ellipsis__', label: theme.glyphs.ellipsis },
        ...items.slice(items.length - (maxItems - 2)),
      ]
    : items;

  return h('box', { role: 'navigation', direction: 'row', gap: 1, ...rest },
    ...shown.flatMap((item, i) => {
      const last = i === shown.length - 1;
      const crumb = h('box', {
        key: item.id,
        direction: 'row',
        gap: item.icon ? 1 : 0,
        onClick: () => { if (item.id !== '__ellipsis__') onSelect?.(item.id); },
      },
        item.icon ? h('text', { content: item.icon }) : null,
        h('text', { content: item.label, fg: last ? 'text' : 'muted', bold: last }),
      );
      return last ? [crumb] : [crumb, h('text', { key: `${item.id}-s`, content: sep, fg: 'subtle' })];
    }),
  );
});

export interface MenuItem {
  id: string;
  label: string;
  icon?: string;
  /** Keyboard hint shown right-aligned. */
  shortcut?: string;
  description?: string;
  disabled?: boolean;
  tone?: SemanticVariant;
  separatorBefore?: boolean;
  /**
   * A switch, and whether it is on. Absent means the row is not a switch, so
   * a menu of ordinary commands keeps its left edge rather than indenting
   * every label to make room for a mark nothing uses.
   */
  checked?: boolean;
  children?: MenuItem[];
}

export interface MenuProps extends BoxProps {
  items: MenuItem[];
  onSelect?(id: string, item: MenuItem): void;
  /** Rows shown at once. */
  visibleRows?: number;
  activeId?: string;
  autoFocus?: boolean;
  /**
   * Take focus and handle keys. Off when something else drives the selection -
   * a command palette, where typing belongs to the search field and the list
   * only follows.
   */
  interactive?: boolean;
}

export const Menu = defineComponent<MenuProps>('Menu', (props) => {
  const theme = useTheme();
  const {
    items, onSelect, visibleRows, activeId, autoFocus, interactive = true, ...rest
  } = props;
  const focus = useFocus({ autoFocus, disabled: !interactive });
  const selectable = items.filter((i) => !i.disabled);
  const [internalHighlight, setHighlight] = useState(
    Math.max(0, items.findIndex((i) => i.id === activeId)),
  );
  // When something else drives the list, `activeId` is the whole truth.
  const highlight = interactive
    ? internalHighlight
    : Math.max(0, items.findIndex((i) => i.id === activeId));

  useInput(
    (event) => {
      switch (event.name) {
        case 'up': setHighlight((highlight - 1 + items.length) % items.length); return true;
        case 'down': setHighlight((highlight + 1) % items.length); return true;
        case 'home': setHighlight(0); return true;
        case 'end': setHighlight(items.length - 1); return true;
        case 'enter': {
          const item = items[highlight];
          if (item && !item.disabled) onSelect?.(item.id, item);
          return true;
        }
        default: return false;
      }
    },
    { focusId: focus.id, enabled: interactive },
  );

  const rows = visibleRows ?? items.length;
  const start = Math.max(0, Math.min(highlight - Math.floor(rows / 2), items.length - rows));
  const window = items.slice(start, start + rows);

  // One switch in the menu gives every row the column, blank on the rows that
  // are not switches. Per-row would left-align the labels differently
  // depending on what happened to be a toggle, which reads as a broken menu.
  const switches = items.some((item) => item.checked !== undefined);

  return h('box', { id: focus.id, role: 'menu', direction: 'column', ...rest },
    ...window.flatMap((item, i) => {
      const active = start + i === highlight;
      const row = h('box', {
        key: item.id,
        role: 'menuitem',
        label: item.label,
        selected: active,
        direction: 'row',
        gap: 1,
        bg: active ? 'selected' : undefined,
        fg: item.disabled ? 'disabled' : active ? 'inverted' : item.tone ? TONE[item.tone] : undefined,
        onClick: () => { if (!item.disabled) onSelect?.(item.id, item); },
      },
        h('text', { content: active ? theme.glyphs.chevronRight : ' ', shrink: 0 }),
        switches
          ? h('text', { content: item.checked === true ? theme.glyphs.check : ' ', shrink: 0 })
          : null,
        // The mark never gives up room. It is the shortest thing on the row
        // and the one that stays legible when everything else is an ellipsis.
        item.icon ? h('text', { content: item.icon, shrink: 0 }) : null,
        // The row under the cursor reads itself out. Everything else is
        // truncated and still, which is what you want of nineteen rows you
        // are scanning past - and useless for the one you have stopped on.
        h(Marquee, { content: item.label, active }),
        h('spacer', { flex: 1 }),
        // The description yields first, and by a lot. It is the elaboration;
        // the label is the thing being chosen, and a row reading "Accept ed…"
        // beside a full sentence has given up the wrong half.
        item.description
          ? h(Marquee, {
            content: item.description,
            active,
            fg: active ? 'inverted' : 'muted',
            shrink: 8,
          })
          : null,
        item.shortcut ? h('text', { content: item.shortcut, fg: active ? 'inverted' : 'subtle' }) : null,
        // Present but empty means "this opens something, contents unknown" -
        // which is what the command palette knows about an argument whose
        // choices it has not resolved yet.
        item.children ? h('text', { content: theme.glyphs.chevronRight }) : null,
      );

      return item.separatorBefore
        ? [h('box', { key: `${item.id}-sep`, height: 1, fill: theme.borderChars().top, fg: 'borderSubtle' }), row]
        : [row];
    }),
    selectable.length === 0
      ? h('text', { content: '  no matches', fg: 'subtle' })
      : null,
  );
});

export interface StatusSegment {
  id: string;
  label: string;
  icon?: string;
  tone?: SemanticVariant;
}

export interface StatusBarProps extends BoxProps {
  /**
   * Segments before the gap and after it. Named `leading`/`trailing` rather
   * than `left`/`right` because those are style props on every node.
   */
  leading?: StatusSegment[];
  trailing?: StatusSegment[];
  separator?: string;
}

export const StatusBar = defineComponent<StatusBarProps>('StatusBar', (props) => {
  const theme = useTheme();
  const { leading = [], trailing = [], separator, ...rest } = props;
  const sep = separator ?? ` ${theme.glyphs.separator} `;

  const segment = (item: StatusSegment): unknown =>
    h('box', { key: item.id, direction: 'row', gap: item.icon ? 1 : 0 },
      item.icon ? h('text', { content: item.icon, fg: item.tone ? TONE[item.tone] : undefined }) : null,
      h('text', { content: item.label, fg: item.tone ? TONE[item.tone] : 'muted' }));

  const join = (items: StatusSegment[]): unknown[] =>
    items.flatMap((item, i) =>
      i === items.length - 1
        ? [segment(item)]
        : [segment(item), h('text', { key: `${item.id}-s`, content: sep, fg: 'subtle' })]);

  return h('box', { role: 'contentinfo', direction: 'row', height: 1, ...rest },
    ...join(leading),
    h('spacer', { flex: 1 }),
    ...join(trailing),
  );
});

export interface ToolbarProps extends BoxProps {
  items: { id: string; label: string; icon?: string; shortcut?: string; disabled?: boolean; tone?: SemanticVariant }[];
  onSelect?(id: string): void;
}

export const Toolbar = defineComponent<ToolbarProps>('Toolbar', ({ items, onSelect, ...rest }) =>
  h('box', { role: 'toolbar', direction: 'row', gap: 2, ...rest },
    ...items.map((item) =>
      h('box', {
        key: item.id,
        direction: 'row',
        gap: 1,
        fg: item.disabled ? 'disabled' : item.tone ? TONE[item.tone] : undefined,
        onClick: () => { if (!item.disabled) onSelect?.(item.id); },
      },
        item.shortcut ? h('text', { content: item.shortcut, fg: 'accent', bold: true }) : null,
        item.icon ? h('text', { content: item.icon }) : null,
        h('text', { content: item.label, fg: 'muted' }),
      )),
  ),
);

export interface KeyHintsProps extends BoxProps {
  hints: { keys: string; label: string }[];
  separator?: string;
}

/** The footer line every TUI needs: what the keys do, right now. */
export const KeyHints = defineComponent<KeyHintsProps>('KeyHints', (props) => {
  const theme = useTheme();
  const { hints, separator, ...rest } = props;
  const sep = separator ?? ` ${theme.glyphs.separator} `;

  return h('box', { direction: 'row', height: 1, ...rest },
    ...hints.flatMap((hint, i) => {
      const item = h('box', { key: hint.keys, direction: 'row', gap: 1 },
        h('text', { content: hint.keys, fg: 'accent', bold: true }),
        h('text', { content: hint.label, fg: 'muted' }));
      return i === hints.length - 1
        ? [item]
        : [item, h('text', { key: `${hint.keys}-s`, content: sep, fg: 'subtle' })];
    }),
  );
});

export interface WizardStep {
  id: string;
  label: string;
  description?: string;
}

export interface WizardProps extends BoxProps {
  steps: WizardStep[];
  activeId: string;
  /** Steps already completed. */
  completedIds?: string[];
  orientation?: 'horizontal' | 'vertical';
}

export const Wizard = defineComponent<WizardProps>('Wizard', (props) => {
  const theme = useTheme();
  const { steps, activeId, completedIds = [], orientation = 'horizontal', ...rest } = props;
  const activeIndex = steps.findIndex((s) => s.id === activeId);

  return h('box', { direction: orientation === 'horizontal' ? 'row' : 'column', gap: orientation === 'horizontal' ? 2 : 0, ...rest },
    ...steps.map((step, i) => {
      const done = completedIds.includes(step.id);
      const active = step.id === activeId;
      const glyph = done ? theme.glyphs.check : active ? theme.glyphs.bulletFilled : theme.glyphs.bulletHollow;
      const tone: StyleColor = done ? 'success' : active ? 'accent' : 'subtle';

      return h('box', { key: step.id, direction: 'row', gap: 1 },
        h('text', { content: glyph, fg: tone }),
        h('box', { direction: 'column' },
          h('text', { content: `${i + 1}. ${step.label}`, bold: active, fg: active ? 'text' : 'muted' }),
          step.description && active
            ? h('text', { content: step.description, fg: 'subtle' })
            : null),
        orientation === 'horizontal' && i < steps.length - 1
          ? h('text', { content: theme.glyphs.chevronRight, fg: i < activeIndex ? 'success' : 'subtle' })
          : null,
      );
    }),
  );
});

export const NAVIGATION_COMPONENTS: ComponentDefinition[] = [
  { component: 'Tabs', category: 'navigation', renderer: { kind: 'function', render: Tabs }, role: 'tablist', variants: ['underline', 'solid', 'plain'], description: 'Tab strip or segmented control.' },
  { component: 'Breadcrumb', category: 'navigation', renderer: { kind: 'function', render: Breadcrumb }, role: 'navigation', description: 'Where you are, collapsing in the middle when narrow.' },
  { component: 'Menu', category: 'navigation', renderer: { kind: 'function', render: Menu }, role: 'menu', description: 'Keyboard-driven list of actions.' },
  { component: 'StatusBar', category: 'chrome', renderer: { kind: 'function', render: StatusBar }, role: 'contentinfo', description: 'One line, segments left and right.' },
  { component: 'Toolbar', category: 'chrome', renderer: { kind: 'function', render: Toolbar }, role: 'toolbar', description: 'A row of actions.' },
  { component: 'KeyHints', category: 'chrome', renderer: { kind: 'function', render: KeyHints }, description: 'What the keys do, right now.' },
  { component: 'Wizard', category: 'navigation', renderer: { kind: 'function', render: Wizard }, description: 'Ordered steps with progress.' },
];
