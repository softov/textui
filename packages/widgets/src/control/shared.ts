import type { BoxProps } from '@textui/core';

export interface TextInputProps extends BoxProps {
  value: string;
  onChange?(value: string): void;
  onSubmit?(value: string): void;
  placeholder?: string;
  label?: string;
  /**
   * Keep the label as the field's name but do not draw it inside the field -
   * for a form or a dialog that already shows it beside or above the input.
   */
  hideLabel?: boolean;
  /** Replace every character, for secrets. */
  mask?: string;
  /** Stop accepting input past this many characters. */
  maxLength?: number;
  autoFocus?: boolean;
  /** Draw a search glyph before the field. */
  search?: boolean;
  /**
   * A stable focus id, so a command can send the reader here by name.
   *
   * Without one a control's id is derived from its instance, which nothing
   * outside the render can know - so "focus the filter" has nothing to name
   * and the key that would do it cannot be written.
   */
  focusId?: string;
  /**
   * The caret tried to leave the field.
   *
   * A single-line input answers `left` and `right` itself right up to the
   * ends, so a caller that wants those keys past the ends cannot have them
   * from a key handler - the field takes the key and reports nothing. This is
   * how it reports: the palette drills into a command's choices on `right`,
   * and the path picker goes up a folder on `left`. `TextArea` has had this
   * from the start; the two controls disagreeing is what left both of those
   * keys silently doing nothing.
   */
  onEdge?(edge: 'start' | 'end'): void;
}
