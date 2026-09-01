import type { BoxProps, ComponentNode, RenderOutput } from '@textui/core';
import {
  defineComponent, h, useApp, useEffect, useFocus, useInput, useMeasure, useState, useTheme,
} from '@textui/core';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
  icon?: string;
}

export interface SelectProps extends BoxProps {
  options: SelectOption[];
  value?: string;
  onChange?(value: string): void;
  label?: string;
  placeholder?: string;
  /** Show the list inline instead of collapsing to one line. */
  open?: boolean;
  /** Rows shown at once when open. */
  visibleRows?: number;
  /**
   * Where the list goes when it opens.
   *
   * `inline` grows the control: the options appear inside the same border, and
   * everything under it moves down. Honest about the space it takes and the
   * only one that cannot be clipped, which is why it is the default.
   *
   * `floating` puts the list on the floating layer, anchored under the
   * control. Nothing below it moves, which is what you want in a form or a
   * dense row of controls - the layout does not jump as you open and shut it.
   *
   * `modal` puts it in the middle of the screen over a scrim. For a list long
   * enough or a choice consequential enough that the rest of the screen is a
   * distraction.
   *
   * The keys are the same in all three, because the control keeps the keyboard
   * in all three: the layer is somewhere to *draw* the list, not somewhere the
   * focus goes. Arrow keys, enter and escape are answered by the same handler
   * whichever mode it is in.
   */
  mode?: 'inline' | 'floating' | 'modal';
}

export const Select = defineComponent<SelectProps>('Select', (props) => {
  const theme = useTheme();
  const {
    options, value, onChange, label, placeholder,
    open: openProp, visibleRows = 6, disabled, mode = 'inline', ...rest
  } = props;

  const app = useApp();
  const focus = useFocus({ disabled });
  const measured = useMeasure();
  const empty = placeholder ?? `Select${theme.glyphs.ellipsis}`;
  const [open, setOpen] = useState(openProp ?? false);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const [highlight, setHighlight] = useState(index);

  useInput(
    (event) => {
      if (disabled) return false;
      if (!open) {
        if (event.name === 'enter' || event.name === 'space' || event.name === 'down') {
          setOpen(true);
          return true;
        }
        return false;
      }
      switch (event.name) {
        case 'up': setHighlight((highlight - 1 + options.length) % options.length); return true;
        case 'down': setHighlight((highlight + 1) % options.length); return true;
        case 'enter': {
          const chosen = options[highlight];
          if (chosen && !chosen.disabled) onChange?.(chosen.value);
          setOpen(false);
          return true;
        }
        case 'escape': setOpen(false); return true;
        default: return false;
      }
    },
    { focusId: focus.id },
  );

  const selected = options.find((o) => o.value === value);
  const start = Math.max(0, Math.min(highlight - Math.floor(visibleRows / 2), options.length - visibleRows));
  const window = options.slice(start, start + visibleRows);

  /**
   * The options, wherever they are being drawn.
   *
   * One function rather than one per mode: three copies of a highlighted row
   * is three chances for the modes to drift into looking like different
   * controls, and the whole claim here is that they are one control shown in
   * three places.
   */
  function list(): RenderOutput {
    return h('box', { direction: 'column' },
          ...window.map((option, i) => {
            const active = start + i === highlight;
            return h('box', {
              key: option.value,
              direction: 'row',
              gap: 1,
              // Ink, not a filled row.
              //
              // A background swatch is the heaviest mark available and it has
              // to invert the text to stay readable, so the highlighted option
              // is the one option whose colour tells you nothing about itself.
              // Accent and an underline say "here" without repainting the row.
              fg: option.disabled ? 'disabled' : active ? 'accent' : undefined,
              onClick: () => {
                if (option.disabled) return;
                onChange?.(option.value);
                setOpen(false);
              },
            },
              h('text', { content: active ? theme.glyphs.chevronRight : ' ' }),
              option.icon ? h('text', { content: option.icon }) : null,
              h('text', { content: option.label, underline: active, bold: active }),
              h('box', { flex: 1 }),
              option.value === value ? h('text', { content: theme.glyphs.check }) : null,
            );
          }));
  }

  /*
   * Opening a layer, and keeping it in step.
   *
   * Two effects rather than one, because they answer different questions. The
   * first is "is there a layer" and runs when the mode or the open state
   * changes; the second is "what is in it" and runs whenever the highlight
   * moves. Reopening on every arrow key would work and would also mean a new
   * layer entry per keystroke, with whatever a layer manager does on open -
   * ordering, focus bookkeeping, the scrim - done four times to move a cursor
   * four rows.
   *
   * The control keeps the keyboard either way, so `trapFocus` stays off: the
   * layer is a surface to draw the list on, and moving focus into it would
   * take the arrow keys away from the handler that answers them.
   */
  const layerId = `select:${focus.id}`;
  const floating = mode !== 'inline';

  useEffect(() => {
    if (!floating || !open) return undefined;
    const handle = app.layers.open({
      id: layerId,
      layer: mode === 'modal' ? 'modal' : 'floating',
      scrim: mode === 'modal',
      // Escape is the control's, and closing it there disposes this. Handled
      // in both places, the layer would close and the control would still
      // think it was open.
      dismissOnEscape: false,
      dismissOnOutsideClick: true,
      position: mode === 'modal'
        ? { kind: 'center' }
        : { kind: 'anchor', targetId: focus.id, side: 'bottom', align: 'start' },
      node: panel(),
      onClose: () => setOpen(false),
    });
    return () => { handle.dispose(); };
  }, [floating, open, mode]);

  useEffect(() => {
    if (!floating || !open) return;
    app.layers.update(layerId, { node: panel() });
  }, [highlight, value, options.length]);

  /** The list with something to sit in, which inline gets from the control. */
  function panel(): ComponentNode {
    return h('box', {
      direction: 'column',
      // As wide as the control it came out of, so the two line up.
      //
      // `useMeasure` reports the *content* rect, and this panel has a frame
      // and a gutter of its own to pay for - the same two the control is
      // already paying - so it is four cells narrower than the box it is
      // supposed to sit under unless they are added back.
      width: Math.max(20, measured.width + 4),
      border: theme.border,
      bg: 'overlay',
      padding: [0, 1],
    }, list()) as ComponentNode;
  }

  /**
   * One box, open or shut.
   *
   * The list used to be a second bordered box under the first, so opening the
   * control drew two rules back to back and the options read as a separate
   * thing that happened to be nearby. They are the control - the same border
   * holds both, with a rule between them where the two borders used to be.
   */
  return h('box', {
    id: focus.id,
    role: 'combobox',
    label,
    direction: 'column',
    border: { style: theme.border, color: focus.focused ? 'focus' : 'border' },
    padding: [0, 1],
    /*
     * The terminal cursor, parked at the start of the value.
     *
     * There is nothing to type here, so this is not a caret - it is the
     * strongest "you are here" a terminal has, and a control that gives it up
     * on focus is one whose only remaining signal is the colour of its border.
     * Tabbing from a text field used to look like the focus had stayed behind
     * in the field, because the cursor had.
     */
    cursor: focus.focused ? 0 : undefined,
    ...rest,
  },
    h('box', {
      direction: 'row',
      gap: 1,
      onClick: () => { if (!disabled) setOpen(!open); },
    },
      label ? h('text', { content: label, fg: 'muted' }) : null,
      h('text', {
        content: selected?.label ?? empty,
        fg: selected ? undefined : 'subtle',
        flex: 1,
        truncate: 'end',
      }),
      h('text', { content: open ? theme.glyphs.chevronUp : theme.glyphs.chevronDown, fg: 'muted' })),

    // A borderless theme has no rule to draw, and a blank row there would be
    // the gap this was meant to close.
    mode === 'inline' && open && theme.border !== 'none'
      ? h('box', { height: 1, fill: theme.borderChars().top, fg: 'borderSubtle' })
      : null,

    mode === 'inline' && open ? list() : null,
  );

});
