import type { BoxProps, SemanticVariant } from '@textui/core';
import { defineComponent, h, useFrame, useTheme } from '@textui/core';
import { TONE as TONE_COLOR } from '../tone.js';

export interface SpinnerProps extends BoxProps {
  label?: string;
  tone?: SemanticVariant;
  frames?: string[];
}

export const DEFAULT_FRAMES = ['-', '\\', '|', '/'];

export const Spinner = defineComponent<SpinnerProps>('Spinner', ({ label, tone = 'accent', frames: customFrames, ...rest }) => {
  const theme = useTheme();
  const frame = useFrame(10);
  const frames = customFrames ?? theme.glyphs.spinner ?? DEFAULT_FRAMES;
  const glyph = frames[frame % frames.length] ?? frames[0] ?? '*';

  return h('box', { role: 'status', direction: 'row', gap: 1, ...rest },
    h('text', { content: glyph, fg: TONE_COLOR[tone] }),
    label ? h('text', { content: label }) : null,
  );
});
