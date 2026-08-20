import type { Disposable } from './disposable.js';
import type { Size } from './geometry.js';
import type { TerminalCapabilities, CapabilityOverrides } from './capabilities.js';
import type { InputEvent } from './input.js';

/**
 * Which capabilities the session wants turned on. The adapter records what it
 * actually acquired, and `release` undoes exactly that and nothing else -
 * which is the whole difference between a managed session and an embedded one.
 */
export interface TerminalSessionOptions {
  /** TextUI owns setup and teardown of the terminal. */
  managed?: boolean;
  altScreen?: boolean;
  mouse?: boolean;
  wheel?: boolean;
  focusEvents?: boolean;
  paste?: boolean;
  hideCursor?: boolean;
  /** Kitty keyboard disambiguation, when available. */
  enhancedKeys?: boolean;
  title?: string;
}

/** What the adapter actually turned on, so release is exact. */
export interface AcquiredState {
  altScreen: boolean;
  mouse: boolean;
  wheel: boolean;
  focusEvents: boolean;
  paste: boolean;
  cursorHidden: boolean;
  enhancedKeys: boolean;
  rawMode: boolean;
  titleSet: boolean;
}

export interface TerminalAdapter extends Disposable {
  readonly id: string;
  size(): Size;
  capabilities(): TerminalCapabilities;
  /** Explicit overrides win over detection. */
  setCapabilityOverrides(overrides: CapabilityOverrides): void;

  acquire(options: TerminalSessionOptions): Promise<AcquiredState> | AcquiredState;
  release(): Promise<void> | void;
  readonly acquired: AcquiredState | null;

  write(data: string): void;
  flush(): Promise<void> | void;

  onInput(fn: (event: InputEvent) => void): Disposable;
  onResize(fn: (size: Size) => void): Disposable;

  /** OSC 52, when the terminal allows it. */
  writeClipboard?(text: string): void;
  setTitle?(title: string): void;
}
