import type { SemanticVariant, TextProps } from '@textui/core';
import { defineComponent, h } from '@textui/core';
import { TONE as TONE_COLOR } from '../tone.js';

export interface LabelProps extends TextProps {
  tone?: SemanticVariant;
}

export const Label = defineComponent<LabelProps>('Label', ({ tone = 'muted', ...props }) =>
  h('text', { role: 'label', fg: TONE_COLOR[tone], ...props }),
);
