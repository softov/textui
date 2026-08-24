import type { BoxProps } from '@textui/core';
import { defineComponent, h, useTheme } from '@textui/core';
import { useFormContext } from './shared.js';

export interface FieldProps extends BoxProps {
  name: string;
  label?: string;
  hint?: string;
  required?: boolean;
  /** Cells reserved for the label, so a column of fields lines up. */
  labelWidth?: number;
  /** Label above the control rather than beside it. */
  stacked?: boolean;
}

/**
 * A labelled control with its error.
 *
 * The error line is always reserved when one could appear, so a form does not
 * jump a row every time validation fires.
 */
export const Field = defineComponent<FieldProps>('Field', (props) => {
  const theme = useTheme();
  const form = useFormContext();
  const { name, label, hint, required, labelWidth, stacked, children, ...rest } = props;
  const error = form.errorFor(name);

  const labelNode = label
    ? h('box', { direction: 'row', gap: 0, width: stacked ? undefined : labelWidth },
        h('text', { content: label, fg: error ? 'danger' : 'muted' }),
        required ? h('text', { content: '*', fg: 'danger' }) : null)
    : null;

  return h('box', { direction: 'column', ...rest },
    // Centred, so the label sits on the control's line of text rather than on
    // the top edge of its frame.
    //
    // A row stretches its children, so a one-row label beside a three-row
    // bordered input was drawn at the top of three rows - level with the
    // border, one above the text it names. Borderless controls are one row
    // and were fine, which is why a form mixing the two had half its labels
    // aligned and half of them a row high.
    h('box', {
      direction: stacked ? 'column' : 'row',
      gap: stacked ? 0 : 1,
      ...(stacked ? {} : { align: 'center' as const }),
    },
      labelNode,
      h('box', { flex: 1 }, children)),
    error
      ? h('box', { direction: 'row', gap: 1 },
          stacked ? null : h('box', { width: labelWidth }),
          h('text', { content: theme.glyphs.warning, fg: 'danger' }),
          h('text', { content: error, fg: 'danger', wrap: 'word' }))
      : hint
        ? h('box', { direction: 'row', gap: 1 },
            stacked ? null : h('box', { width: labelWidth }),
            h('text', { content: hint, fg: 'subtle' }))
        : null,
  );
});
