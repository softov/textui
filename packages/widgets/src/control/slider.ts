import type { BoxProps } from '@textui/core';
import { defineComponent, h, useFocus, useInput, useTheme } from '@textui/core';

export interface SliderProps extends BoxProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  onChange?(value: number): void;
  /** Cells the track occupies. */
  trackWidth?: number;
  format?(value: number): string;
}

export const Slider = defineComponent<SliderProps>('Slider', (props) => {
  const theme = useTheme();
  const {
    value, min = 0, max = 100, step = 1, label, onChange,
    trackWidth = 20, format, disabled, ...rest
  } = props;
  const focus = useFocus({ disabled });

  const clamp = (v: number): number => Math.max(min, Math.min(max, v));

  useInput(
    (event) => {
      if (disabled) return false;
      const big = Math.max(step, Math.round((max - min) / 10));
      switch (event.name) {
        case 'left': onChange?.(clamp(value - step)); return true;
        case 'right': onChange?.(clamp(value + step)); return true;
        case 'pagedown': onChange?.(clamp(value - big)); return true;
        case 'pageup': onChange?.(clamp(value + big)); return true;
        case 'home': onChange?.(min); return true;
        case 'end': onChange?.(max); return true;
        default: return false;
      }
    },
    { focusId: focus.id },
  );

  const ratio = max === min ? 0 : (clamp(value) - min) / (max - min);
  const filled = Math.round(ratio * (trackWidth - 1));

  // Track, thumb and remainder all come from the theme, so an ascii terminal
  // gets `--o--` rather than a row of question marks.
  const thumb = theme.glyphs.bulletFilled;
  const done = theme.glyphs.progressFull;
  const todo = theme.glyphs.progressEmpty;
  const track = Array.from({ length: trackWidth }, (_, i) =>
    i === filled ? thumb : i < filled ? done : todo,
  ).join('');

  return h('box', { id: focus.id, role: 'slider', label, direction: 'row', gap: 1, ...rest },
    label ? h('text', { content: label, fg: 'muted' }) : null,
    h('text', {
      content: track,
      fg: disabled ? 'disabled' : focus.focused ? 'accent' : 'border',
    }),
    h('text', { content: format ? format(value) : String(value), fg: 'muted' }),
  );
});
