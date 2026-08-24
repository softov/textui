import type { BoxProps } from '@textui/core';
import { defineComponent, h, useFocus, useInput } from '@textui/core';


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
