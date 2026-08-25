import type { Disposable } from './disposable.js';

export interface KeyModifiers {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
}

/**
 * Canonical key name. Printable keys carry the character itself; everything
 * else uses these names, so a keybinding string is stable across terminals.
 */
export type KeyName =
  | 'up' | 'down' | 'left' | 'right'
  | 'enter' | 'escape' | 'tab' | 'backspace' | 'delete' | 'space'
  | 'home' | 'end' | 'pageup' | 'pagedown' | 'insert'
  | 'f1' | 'f2' | 'f3' | 'f4' | 'f5' | 'f6'
  | 'f7' | 'f8' | 'f9' | 'f10' | 'f11' | 'f12'
  | (string & {});

export interface KeyEvent {
  type: 'key';
  /** Canonical name, or the printable character. */
  name: KeyName;
  /** The character produced, when printable. */
  char?: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
  /** Raw bytes, for adapters and diagnostics. */
  raw: string;
  /** Set by a handler to stop propagation up the focus chain. */
  handled: boolean;
  /** Kitty protocol only - press/repeat/release. */
  kind?: 'press' | 'repeat' | 'release';
}

export type MouseButton = 'left' | 'middle' | 'right' | 'none';
export type MouseAction = 'down' | 'up' | 'move' | 'drag' | 'wheel';

export interface MouseEvent {
  type: 'mouse';
  action: MouseAction;
  button: MouseButton;
  /** Terminal cell coordinates, 0-based. */
  x: number;
  y: number;
  /** Negative up, positive down. */
  wheel?: number;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  /**
   * When it happened, in milliseconds.
   *
   * A terminal reports presses and releases and never says "double click" -
   * there is no such thing on the wire - so telling one gesture from two is
   * arithmetic on when they arrived and where. Stamped by whatever produced
   * the event, which is the only thing that knows.
   */
  at?: number;
  handled: boolean;
}

export interface PasteEvent {
  type: 'paste';
  text: string;
  handled: boolean;
}

/** Terminal-level focus (the window), not component focus. */
export interface TerminalFocusEvent {
  type: 'terminal-focus';
  focused: boolean;
}

export interface ResizeEvent {
  type: 'resize';
  width: number;
  height: number;
}

export type InputEvent =
  | KeyEvent | MouseEvent | PasteEvent | TerminalFocusEvent | ResizeEvent;

export interface InputSource extends Disposable {
  on(fn: (event: InputEvent) => void): Disposable;
}
