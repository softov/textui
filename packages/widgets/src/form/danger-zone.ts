import type { BoxProps } from '@textui/core';
import { defineComponent, h, useI18n, useTheme } from '@textui/core';
import { Button } from '../control/index.js';

export interface DangerZoneProps extends BoxProps {
  title?: string;
  description?: string;
  actionLabel: string;
  onAction?(): void;
  /** Require typing this exact text before the action is enabled. */
  confirmText?: string;
}

export const DangerZone = defineComponent<DangerZoneProps>('DangerZone', (props) => {
  const theme = useTheme();
  const i18n = useI18n();
  const {
    title = i18n.t('textui.dangerZone.title', undefined, 'Danger zone'), description, actionLabel, onAction, confirmText, ...rest
  } = props;

  return h('box', {
    border: { style: theme.border, color: 'danger' },
    padding: [0, 1],
    direction: 'column',
    title: ` ${title} `,
    ...rest,
  },
    description ? h('text', { content: description, fg: 'muted', wrap: 'word' }) : null,
    confirmText
      ? h('text', {
        content: i18n.t('textui.dangerZone.confirm', { text: confirmText }, 'Type "{text}" to confirm.'),
        fg: 'subtle',
      })
      : null,
    h('box', { direction: 'row', justify: 'end' },
      h(Button, { label: actionLabel, tone: 'danger', variant: 'outline', onPress: onAction })),
  );
});
