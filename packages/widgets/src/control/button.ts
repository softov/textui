import type {
  BorderStyle,
  BoxProps,
  SemanticVariant,
  StyleColor,
  SurfaceVariant,
} from '@textui/core';
import { defineComponent, h, useFocus, useInput, useTheme } from '@textui/core';
import { ON_TONE, TONE } from '../tone.js';

/** A border that takes up space without drawing anything. */
const BLANK_BORDER = {
  topLeft: ' ', top: ' ', topRight: ' ', right: ' ',
  bottomRight: ' ', bottom: ' ', bottomLeft: ' ', left: ' ',
  cross: ' ', teeTop: ' ', teeBottom: ' ', teeLeft: ' ', teeRight: ' ',
};

export interface ButtonProps extends BoxProps {
  label: string;
  tone?: SemanticVariant;
  variant?: SurfaceVariant;
  icon?: string;
  /** Shortcut hint rendered after the label. */
  hint?: string;
  onPress?(): void;
  autoFocus?: boolean;
  /**
   * How much of the screen the button takes, and how heavy its edge is.
   *
   * `md` is a button: three rows, the theme's edge. `sm` is one row with no
   * edge at all, for a toolbar or a row of buttons that must not out-weigh
   * the fields beside them. `lg` is three rows with a heavy one.
   *
   * It matters most when filled. A solid `md` draws its edge in half-blocks,
   * so it stands the same height as the outline button next to it without
   * reading as a heavier object; `lg` fills the edge cells too and becomes
   * the whole rectangle, which is what solid used to do at every size - and
   * why one row of buttons looked bigger than the row above it.
   */
  size?: 'sm' | 'md' | 'lg';
}

export const Button = defineComponent<ButtonProps>('Button', (props) => {
  const theme = useTheme();
  const {
    label, tone = 'default', variant = 'outline', icon, hint,
    onPress, disabled, autoFocus, size = 'md', ...rest
  } = props;

  const focus = useFocus({ disabled, autoFocus });
  useInput(
    (event) => {
      if (disabled) return false;
      if (event.name === 'enter' || event.name === 'space') {
        onPress?.();
        return true;
      }
      return false;
    },
    { focusId: focus.id },
  );

  // Selection inverts.
  //
  // At rest a button is a line and a label in its tone; selected, the tone
  // becomes the background and the label flips to the colour written for it.
  // Recolouring only the border was too quiet to find - and next to a filled
  // button it read backwards, because the filled one looked like the selected
  // one however hard the border tried.
  const filled = (focus.focused || props.selected === true) && !disabled;
  const resolvedTone = filled && tone === 'default' ? 'primary' : tone;

  const color = disabled ? 'disabled' : TONE[resolvedTone];
  const onColor = disabled ? 'text' : ON_TONE[resolvedTone];

  // `sm` has no ring, so nothing here reserves one.
  const ringed = size !== 'sm' && theme.border !== 'none';

  // A solid button reserves the same ring an outline one draws, filled with
  // its own background rather than left out. Without it the two are one row
  // and three rows tall, and a dialog's OK sits a line above its Cancel.
  const solidBorder = {
    style: theme.border,
    color: focus.focused ? ('focus' as StyleColor) : undefined,
    ...(focus.focused ? {} : { chars: BLANK_BORDER }),
  };

  // The tone fills the inside of the frame, not the frame itself. A cell
  // carries one background, so a background on the button's own box lands on
  // the border glyphs too - rounded corners included - and the button reads as
  // a coloured block rather than a filled button. Hanging the fill on an inner
  // box leaves the ring on whatever is behind it. The wrapper is there whether
  // or not the button is filled, so focusing one does not reshape its tree.
  //
  // A solid button is inset too at `md`, which is the whole of the size fix:
  // hanging the fill on an inner box leaves the ring to be drawn in
  // half-blocks rather than filled through, so it weighs what the outline
  // button beside it weighs. `lg` keeps the fill on the outer box - the ring
  // cells take the tone as well and the button becomes a solid rectangle.
  const inset = variant === 'ghost' || variant === 'link'
    ? false
    : variant !== 'solid' || (ringed && size === 'md');

  // Filled, the frame becomes the fill's own edge.
  //
  // A cell holds one background, so filling the box the ordinary way colours
  // its border glyphs too and the button reads as a block; filling only the
  // inside leaves the border cell on the backdrop, and a gap runs between the
  // frame and the fill. `half` is drawn from block elements whose coloured
  // half faces inward, so the ring meets the inside with nothing between. It
  // measures the same as the line border it replaces - one cell a side - so
  // focus changes how a button looks without changing its size.
  //
  // A theme that asked for no border, or for ascii, is left alone: both are
  // deliberate looks, and `half` degrades to ascii anyway on a terminal that
  // cannot draw block elements.
  const filledBorder: BorderStyle =
    theme.border === 'none' || theme.border === 'ascii' ? theme.border : 'half';

  // The edge, by size. `lg` asks for the heaviest line the theme can draw and
  // falls back to the theme's own where there is none to ask for.
  const edge: BorderStyle = size === 'lg' && theme.border !== 'ascii' ? 'bold' : theme.border;

  const style =
    variant === 'solid'
      ? size === 'sm' || !ringed
        // One row, filled. No ring to reserve and nothing to align to.
        ? { bg: color, fg: onColor }
        : size === 'lg'
          // The fill runs under the ring, so the whole rectangle is the button.
          ? { bg: color, fg: onColor, border: solidBorder }
          // The ring is drawn from block elements whose coloured half faces
          // inward: it meets the fill with no gap and stands half as heavy.
          : { border: { style: filledBorder, color }, fg: color }
      : variant === 'ghost' || variant === 'link'
        ? (filled ? { bg: color, fg: onColor } : { fg: color })
        : size === 'sm' || !ringed
          ? (filled ? { bg: color, fg: onColor } : { fg: color })
          : { border: { style: filled ? filledBorder : edge, color }, fg: color };

  const padding = variant === 'ghost' || variant === 'link' ? 0 : ([0, 1] as [number, number]);

  const content = [
    icon ? h('text', { content: icon }) : null,
    h('text', { content: label }),
    // On a filled button the hint has to sit on the tone too; `muted` against
    // a solid colour is the one combination that is never readable.
    hint ? h('text', { content: hint, fg: filled ? onColor : 'muted', dim: !filled }) : null,
  ];

  return h('box', {
    id: focus.id,
    role: 'button',
    label,
    direction: 'row',
    // The inner box owns the run of the label - gap, padding and centring -
    // whenever there is one, so the two paths measure the same.
    gap: inset ? 0 : 1,
    // Centred, so a button stretched by the row it sits in keeps its label on
    // the same line as its neighbours' labels.
    align: 'center',
    padding: inset ? 0 : padding,
    bold: inset ? undefined : focus.focused,
    underline: focus.focused && (variant === 'ghost' || variant === 'link'),
    onClick: () => { if (!disabled) onPress?.(); },
    ...style,
    ...rest,
  },
    inset
      ? h('box', {
          // Grow, so the fill reaches the frame on a button the row stretched.
          flex: 1,
          direction: 'row',
          gap: 1,
          align: 'center',
          padding,
          bold: focus.focused,
          // A solid button is filled whether or not it has focus - that is
          // what solid means. An outline one fills only when it takes focus.
          ...(variant === 'solid' || filled ? { bg: color, fg: onColor } : {}),
        }, ...content)
      : content,
  );
});
