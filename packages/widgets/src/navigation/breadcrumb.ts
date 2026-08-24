import type { BoxProps } from '@textui/core';
import { defineComponent, h, useTheme } from '@textui/core';

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
