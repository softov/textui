import { defineComponent, h } from '@textui/core';
import type { TextInputProps } from './shared.js';
import { TextInput } from './text-input.js';

export interface SearchBoxProps extends Omit<TextInputProps, 'search'> {
  /** Result count, shown after the field. */
  count?: number;
}

export const SearchBox = defineComponent<SearchBoxProps>('SearchBox', ({ count, ...props }) =>
  h('box', { direction: 'row', gap: 1 },
    h(TextInput, { search: true, flex: 1, ...props }),
    count !== undefined ? h('text', { content: `${count}`, fg: 'muted' }) : null,
  ),
);
