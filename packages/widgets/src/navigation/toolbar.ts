import type { BoxProps, SemanticVariant } from '@textui/core';
import { defineComponent, h } from '@textui/core';
import { TONE } from '../tone.js';

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
