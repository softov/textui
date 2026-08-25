import type { BoxProps, SemanticVariant } from '@textui/core';
import { defineComponent, h, stringWidth, useFocus, useInput, useState, useTheme } from '@textui/core';
import { Marquee } from '../display/index.js';
import { TONE } from '../tone.js';

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
   * A heading on the line above this row, naming the group it starts.
   *
   * The name of a group belongs to the group, so it is said once at the top
   * of it rather than repeated on every row - a column reading "Screens,
   * Screens, Screens" spends the width that the rows themselves need, and
   * still does not say where one group ends.
   *
   * It takes the line a `separatorBefore` would have used rather than adding
   * one, so a grouped menu is the same height either way.
   */
  sectionBefore?: string;
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
   * Where a row's description goes.
   *
   * `inline` right-aligns it on the row, sharing the width with the label -
   * which is the right shape for a word or two of state. `below` gives it a
   * line of its own under the label, indented to it, which is the only shape
   * that fits a sentence: inline, a list of modes whose whole difference is
   * the sentence under each shows the same truncated half of every one.
   *
   * `below` makes every row two lines, so `visibleRows` buys half as much.
   */
  descriptions?: 'inline' | 'below';
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
    items, onSelect, visibleRows, activeId, autoFocus, interactive = true,
    descriptions = 'inline', ...rest
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
      const below = descriptions === 'below' && item.description !== undefined;

      const head = h('box', { direction: 'row', gap: 1 },
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
        item.description && !below
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

      const row = h('box', {
        key: item.id,
        role: 'menuitem',
        label: item.label,
        selected: active,
        direction: 'column',
        // One background over both lines: a highlight that stopped after the
        // label would split the row it is highlighting in two.
        bg: active ? 'selected' : undefined,
        fg: item.disabled ? 'disabled' : active ? 'inverted' : item.tone ? TONE[item.tone] : undefined,
        onClick: () => { if (!item.disabled) onSelect?.(item.id, item); },
      },
        head,
        // Under the label rather than under the cursor: the sentence is about
        // the thing being chosen, so it starts where that thing starts.
        below
          ? h('box', { direction: 'row' },
            h('text', { content: ' '.repeat(leading(item, switches)), shrink: 0 }),
            // A `Marquee`, like the inline one: a sentence too long for the
            // panel is still readable on the row the cursor is on, by sliding
            // it. Truncated and still is right for the rows being scanned past
            // and useless for the one that has been stopped on.
            h(Marquee, {
              content: item.description as string,
              active,
              fg: active ? 'inverted' : 'muted',
              flex: 1,
            }))
          : null,
      );

      if (item.sectionBefore) {
        return [
          h('box', { key: `${item.id}-sec`, role: 'heading', direction: 'row', gap: 1 },
            // The same leading columns the rows have, so a heading sits over
            // the labels it names rather than over the cursor's gutter.
            h('text', { content: ' ', shrink: 0 }),
            switches ? h('text', { content: ' ', shrink: 0 }) : null,
            h('text', { content: item.sectionBefore, bold: true, fg: 'muted', truncate: 'end' })),
          row,
        ];
      }

      return item.separatorBefore
        ? [h('box', { key: `${item.id}-sep`, height: 1, fill: theme.borderChars().top, fg: 'borderSubtle' }), row]
        : [row];
    }),
    selectable.length === 0
      ? h('text', { content: '  no matches', fg: 'subtle' })
      : null,
  );
});

/**
 * The columns before a row's label, so a second line can start under it.
 *
 * The cursor's column and the switch's are the same on every row - that is
 * what keeps a menu's left edge straight - but the icon is per-row and may be
 * two cells wide, so it has to be measured rather than assumed.
 */
function leading(item: MenuItem, switches: boolean): number {
  // The marker, plus the gap after it.
  let width = 2;
  if (switches) width += 2;
  if (item.icon) width += stringWidth(item.icon) + 1;
  return width;
}
