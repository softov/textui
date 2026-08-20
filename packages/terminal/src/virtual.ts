import type {
  AcquiredState, CapabilityOverrides, Disposable, InputEvent, Size,
  TerminalAdapter, TerminalCapabilities, TerminalSessionOptions,
} from '@textui/core';
import { FULL_CAPABILITIES, toDisposable } from '@textui/core';
import { createDecoder, type InputDecoder } from './input.js';

/**
 * A terminal with no terminal behind it.
 *
 * The same adapter serves three cases that turn out to be one case: the test
 * harness, an application embedded in a host that owns the real tty, and a
 * browser-hosted terminal such as xterm.js where output goes to a callback
 * rather than a file descriptor.
 *
 * Because it is embedded by default, `acquire` records nothing it did not do -
 * and it does nothing to anyone's terminal.
 */

export interface VirtualAdapterOptions {
  width?: number;
  height?: number;
  capabilities?: CapabilityOverrides;
  /** Where encoded output goes. Omit to only accumulate it. */
  onWrite?(data: string): void;
  /** Keep every chunk written, for assertions. */
  record?: boolean;
  /** True when this adapter owns terminal setup. Defaults to false. */
  managed?: boolean;
}

const NOTHING_ACQUIRED: AcquiredState = {
  altScreen: false, mouse: false, wheel: false, focusEvents: false,
  paste: false, cursorHidden: false, enhancedKeys: false, rawMode: false,
  titleSet: false,
};

export class VirtualTerminalAdapter implements TerminalAdapter {
  readonly id = 'virtual';

  private caps: TerminalCapabilities;
  private state: AcquiredState | null = null;
  private currentSize: Size;
  private pending: string[] = [];
  private written: string[] = [];
  private inputListeners = new Set<(event: InputEvent) => void>();
  private resizeListeners = new Set<(size: Size) => void>();
  private decoder: InputDecoder;
  private title: string | null = null;
  private clipboard: string | null = null;

  constructor(private options: VirtualAdapterOptions = {}) {
    this.currentSize = {
      width: options.width ?? 80,
      height: options.height ?? 24,
    };
    this.caps = { ...FULL_CAPABILITIES, ...options.capabilities };
    this.decoder = createDecoder((event) => this.dispatch(event), { escapeTimeoutMs: 0 });
  }

  get acquired(): AcquiredState | null {
    return this.state;
  }

  size(): Size {
    return this.currentSize;
  }

  capabilities(): TerminalCapabilities {
    return this.caps;
  }

  setCapabilityOverrides(overrides: CapabilityOverrides): void {
    this.caps = { ...this.caps, ...overrides };
  }

  acquire(options: TerminalSessionOptions): AcquiredState {
    const managed = options.managed ?? this.options.managed ?? false;
    this.state = managed
      ? {
          ...NOTHING_ACQUIRED,
          altScreen: (options.altScreen ?? true) && this.caps.altScreen,
          mouse: (options.mouse ?? false) && this.caps.mouse,
          wheel: (options.wheel ?? true) && this.caps.wheel,
          focusEvents: (options.focusEvents ?? false) && this.caps.focusEvents,
          paste: (options.paste ?? true) && this.caps.paste,
          cursorHidden: (options.hideCursor ?? true) && this.caps.cursor,
        }
      : { ...NOTHING_ACQUIRED };
    return this.state;
  }

  release(): void {
    this.state = null;
    this.decoder.reset();
  }

  write(data: string): void {
    if (data === '') return;
    this.pending.push(data);
  }

  flush(): void {
    if (this.pending.length === 0) return;
    const data = this.pending.join('');
    this.pending = [];
    if (this.options.record !== false) this.written.push(data);
    this.options.onWrite?.(data);
  }

  onInput(fn: (event: InputEvent) => void): Disposable {
    this.inputListeners.add(fn);
    return toDisposable(() => this.inputListeners.delete(fn));
  }

  onResize(fn: (size: Size) => void): Disposable {
    this.resizeListeners.add(fn);
    return toDisposable(() => this.resizeListeners.delete(fn));
  }

  writeClipboard(text: string): void {
    this.clipboard = text;
  }

  setTitle(title: string): void {
    this.title = title;
  }

  // ----------------------------------------------------------- test surface

  /** Feed raw bytes, exactly as a terminal would deliver them. */
  feed(data: string): void {
    this.decoder.feed(data);
  }

  /** Deliver an already-decoded event. */
  send(event: InputEvent): void {
    this.dispatch(event);
  }

  resize(width: number, height: number): void {
    if (width === this.currentSize.width && height === this.currentSize.height) return;
    this.currentSize = { width, height };
    for (const fn of [...this.resizeListeners]) fn(this.currentSize);
  }

  /** Everything written since the last `clearOutput`. */
  output(): string {
    return this.written.join('');
  }

  chunks(): string[] {
    return [...this.written];
  }

  clearOutput(): void {
    this.written = [];
  }

  currentTitle(): string | null {
    return this.title;
  }

  clipboardContents(): string | null {
    return this.clipboard;
  }

  private dispatch(event: InputEvent): void {
    if (event.type === 'resize') {
      this.resize(event.width, event.height);
      return;
    }
    for (const fn of [...this.inputListeners]) fn(event);
  }

  dispose(): void {
    this.release();
    this.inputListeners.clear();
    this.resizeListeners.clear();
  }
}

export function createVirtualTerminal(options?: VirtualAdapterOptions): VirtualTerminalAdapter {
  return new VirtualTerminalAdapter(options);
}
