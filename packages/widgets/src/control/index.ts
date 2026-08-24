import type { ComponentDefinition } from '@textui/core';
import { Button } from './button.js';
import { Checkbox } from './checkbox.js';
import { RadioGroup } from './radio-group.js';
import { SearchBox } from './search-box.js';
import { Select } from './select.js';
import { Slider } from './slider.js';
import { Switch } from './switch.js';
import { TextArea } from './text-area.js';
import { TextInput } from './text-input.js';

/**
 * Controls.
 *
 * Every control here is focusable, keyboard-first and states its own focus
 * ring, because a terminal has no hover to fall back on: if the focused
 * control is not obvious without moving a mouse, the interface is unusable.
 */
export * from './button.js';
export * from './checkbox.js';
export * from './radio-group.js';
export * from './search-box.js';
export * from './select.js';
export * from './slider.js';
export * from './switch.js';
export * from './text-area.js';
export * from './text-input.js';
export type { TextInputProps } from './shared.js';

export const CONTROL_COMPONENTS: ComponentDefinition[] = [
  { component: 'Button', category: 'control', renderer: { kind: 'function', render: Button }, role: 'button', variants: ['solid', 'outline', 'ghost', 'link'], description: 'Focusable action.' },
  { component: 'Checkbox', category: 'control', renderer: { kind: 'function', render: Checkbox }, role: 'checkbox', description: 'On, off, or mixed.' },
  { component: 'Switch', category: 'control', renderer: { kind: 'function', render: Switch }, role: 'switch', description: 'Two-state toggle with words, not only colour.' },
  { component: 'RadioGroup', category: 'control', renderer: { kind: 'function', render: RadioGroup }, role: 'radio', description: 'One of several.' },
  { component: 'Slider', category: 'control', renderer: { kind: 'function', render: Slider }, role: 'slider', description: 'A value along a track.' },
  { component: 'TextArea', category: 'control', renderer: { kind: 'function', render: TextArea }, role: 'textbox', description: 'A field that is a paragraph: grows, scrolls, and gives back the keys it does not want.' },
  { component: 'TextInput', category: 'control', renderer: { kind: 'function', render: TextInput }, role: 'textbox', description: 'Single-line text with a real caret.' },
  { component: 'Select', category: 'control', renderer: { kind: 'function', render: Select }, role: 'combobox', description: 'Pick from a list, collapsed or open.' },
  { component: 'SearchBox', category: 'control', renderer: { kind: 'function', render: SearchBox }, role: 'searchbox', description: 'A text field that looks like search.' },
];
