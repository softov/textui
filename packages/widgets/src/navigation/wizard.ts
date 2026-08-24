import type { BoxProps, StyleColor } from '@textui/core';
import { defineComponent, h, useTheme } from '@textui/core';

export interface WizardStep {
  id: string;
  label: string;
  description?: string;
}

export interface WizardProps extends BoxProps {
  steps: WizardStep[];
  activeId: string;
  /** Steps already completed. */
  completedIds?: string[];
  orientation?: 'horizontal' | 'vertical';
}

export const Wizard = defineComponent<WizardProps>('Wizard', (props) => {
  const theme = useTheme();
  const { steps, activeId, completedIds = [], orientation = 'horizontal', ...rest } = props;
  const activeIndex = steps.findIndex((s) => s.id === activeId);

  return h('box', { direction: orientation === 'horizontal' ? 'row' : 'column', gap: orientation === 'horizontal' ? 2 : 0, ...rest },
    ...steps.map((step, i) => {
      const done = completedIds.includes(step.id);
      const active = step.id === activeId;
      const glyph = done ? theme.glyphs.check : active ? theme.glyphs.bulletFilled : theme.glyphs.bulletHollow;
      const tone: StyleColor = done ? 'success' : active ? 'accent' : 'subtle';

      return h('box', { key: step.id, direction: 'row', gap: 1 },
        h('text', { content: glyph, fg: tone }),
        h('box', { direction: 'column' },
          h('text', { content: `${i + 1}. ${step.label}`, bold: active, fg: active ? 'text' : 'muted' }),
          step.description && active
            ? h('text', { content: step.description, fg: 'subtle' })
            : null),
        orientation === 'horizontal' && i < steps.length - 1
          ? h('text', { content: theme.glyphs.chevronRight, fg: i < activeIndex ? 'success' : 'subtle' })
          : null,
      );
    }),
  );
});
