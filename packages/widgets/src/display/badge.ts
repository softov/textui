import type { BoxProps, SemanticVariant, SurfaceVariant } from '@textui/core';
import { defineComponent, h } from '@textui/core';
import { ON_TONE, TONE as TONE_COLOR } from '../tone.js';

export interface BadgeProps extends BoxProps {
  label: string;
  tone?: SemanticVariant;
  variant?: SurfaceVariant;
  /** Glyph before the label, so the badge reads without colour. */
  icon?: string;
}

export const Badge = defineComponent<BadgeProps>('Badge', (props) => {
  const { label, tone = 'default', variant = 'ghost', icon, ...rest } = props;
  const color = TONE_COLOR[tone];

  // `ghost` is chrome-less: the tone, and nothing around it. That is the
  // default because it is the badge that fits in a sentence, and it is what
  // `ghost` already means on Button - one word, one meaning, both components.
  const style =
    variant === 'solid' ? { bg: color, fg: ON_TONE[tone] } : { fg: color };

  // A badge is inline: it sits in a row of text and must stay one line tall.
  // The outline variant is therefore brackets rather than a box border - a
  // three-row chip in a sentence is not an outline, it is a panel.
  const brackets = variant === 'outline';

  return h('box', {
    direction: 'row',
    gap: icon ? 1 : 0,
    padding: variant === 'solid' ? [0, 1] : 0,
    ...style,
    ...rest,
  },
    brackets ? h('text', { content: '[' }) : null,
    icon ? h('text', { content: icon }) : null,
    h('text', { content: label }),
    brackets ? h('text', { content: ']' }) : null,
  );
});
