import type { BoxProps } from '@textui/core';
import { defineComponent, h, useFocus, useInput, useTheme } from '@textui/core';

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
