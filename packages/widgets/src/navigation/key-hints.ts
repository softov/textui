import type { BoxProps } from '@textui/core';
import { defineComponent, h, useTheme } from '@textui/core';

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
