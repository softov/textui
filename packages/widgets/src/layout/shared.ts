import { defineComponent, h, useTheme } from '@textui/core';

export const Scrollbar = defineComponent<{ offset: number }>('Scrollbar', () => {
  // The track is a border glyph, so it degrades with the rest of the chrome
  // rather than punching a stray box-drawing character through an ascii frame.
  const theme = useTheme();
  return h('box', { width: 1, fill: theme.borderChars().left, fg: 'borderSubtle' });
});
