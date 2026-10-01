import type { BoxProps } from '@textui/core';
import { defineComponent, h, useTheme } from '@textui/core';

export interface CardProps extends BoxProps {
  title?: string;
  subtitle?: string;
  footer?: string;
}

export const Card = defineComponent<CardProps>('Card', (props) => {
  const theme = useTheme();
  const { title, subtitle, children, ...rest } = props;
  return h('box', {
    border: theme.border,
    /*
     * A card is a surface, so it states a background and is opaque.
     *
     * A bordered box that states none is a frame around whatever is already
     * there, and what is already there can be a pattern, a scrim or a
     * neighbouring block - a card dropped on a pattern showed the pattern
     * through its own interior, which reads as a hole rather than as something
     * laid on top. `Dialog` and `CommandPalette` have always stated `overlay`
     * for the same reason; this is the page-level one. `...rest` still wins, so
     * a caller that wants a different colour names it.
     */
    bg: 'surface',
    padding: theme.density === 'compact' ? 0 : [0, 1],
    direction: 'column',
    title,
    ...rest,
  },
    subtitle ? h('text', { content: subtitle, fg: 'muted' }) : null,
    children,
  );
});
