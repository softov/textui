import type { AcquiredState, CapabilityOverrides, CursorStyle, Disposable, InputEvent, Size, TerminalAdapter, TerminalCapabilities, TerminalSessionOptions } from '@textui/core';
import { toDisposable } from '@textui/core';
import * as ansi from './ansi.js';
import { applyOverrides, detectCapabilities, describeEnvironment } from './capabilities.js';
import { createDecoder, type InputDecoder } from './input.js';

/**
 * The Node TTY adapter.
 *
 * Ownership is the whole point of this file. `acquire` records exactly what it
 * turned on and `release` undoes exactly that - so an application that owns
 * the terminal gets a clean alternate screen, and one embedded in a host that
 * already set raw mode does not tear the host's state down on the way out.
 *
 * A terminal left in raw mode with the cursor hidden is a broken shell, so
 * release also runs on exit and on a fatal signal, not only on a tidy stop.
 */

/**
 * What this adapter needs from a stream, rather than which stream it is.
 *
 * `process.stdin` and `process.stdout` satisfy these, so nothing changes for
 * a caller - but the published types stop naming Node's stream interfaces,
 * which come from a package this one does not depend on. It compiled here
 * only because those types happened to be installed at the root; a consumer
 * without them got `Cannot find namespace` out of a package that advertises
 * no dependencies.
 *
 * Saying it structurally also makes the requirement legible - "something with
 * `setRawMode` and `columns`" is a contract, where "Node's stream" is a shrug
 * - and makes it true of the runtimes whose streams are not Node's. Bun and
 * Deno satisfy these by shape rather than by luck.
 */
export interface TerminalInput {
  isTTY?: boolean;
  /** True while the terminal is delivering keys rather than lines. */
  isRaw?: boolean;
  setRawMode?(raw: boolean): void;
  setEncoding(encoding: 'utf8'): void;
  on(event: 'data', listener: (chunk: string) => void): void;
  off(event: 'data', listener: (chunk: string) => void): void;
  pause(): void;
  resume(): void;
}

export interface TerminalOutput {
  isTTY?: boolean;
  columns?: number;
  rows?: number;
  write(data: string): void;
  on(event: 'resize', listener: () => void): void;
  off(event: 'resize', listener: () => void): void;
}

/** The three this adapter installs handlers for. */
export type TerminalSignal = 'SIGINT' | 'SIGTERM' | 'SIGHUP';

export interface NodeAdapterOptions {
  stdin?: TerminalInput;
  stdout?: TerminalOutput;
  env?: Record<string, string | undefined>;
  capabilities?: CapabilityOverrides;
  /** Install exit and signal handlers that release the terminal. */
  installExitHandlers?: boolean;
  escapeTimeoutMs?: number;
}

const NOTHING_ACQUIRED: AcquiredState = {
  altScreen: false, mouse: false, wheel: false, focusEvents: false,
  paste: false, cursorHidden: false, enhancedKeys: false, rawMode: false,
  titleSet: false, cursorShaped: false,
};

export class NodeTerminalAdapter implements TerminalAdapter {
  readonly id = 'node';

  private stdin: TerminalInput;
  private stdout: TerminalOutput;
  private env: Record<string, string | undefined>;
  private overrides: CapabilityOverrides;

  private caps: TerminalCapabilities;
  private state: AcquiredState | null = null;

  private decoder: InputDecoder | null = null;
  private inputListeners = new Set<(event: InputEvent) => void>();
  private resizeListeners = new Set<(size: Size) => void>();

  private pending: string[] = [];
  private onStdinData = (chunk: Buffer | string): void => {
    this.decoder?.feed(typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
  };
  private handleResize = (): void => {
    const size = this.size();
    for (const fn of [...this.resizeListeners]) fn(size);
  };
  private exitHandler: (() => void) | null = null;
  private signalHandler: ((signal: TerminalSignal) => void) | null = null;

  constructor(private options: NodeAdapterOptions = {}) {
    this.stdin = options.stdin ?? process.stdin;
    this.stdout = options.stdout ?? process.stdout;
    this.env = options.env ?? process.env;
    this.overrides = options.capabilities ?? {};
    this.caps = this.detect();
  }

  private detect(): TerminalCapabilities {
    return applyOverrides(
      detectCapabilities({
        env: this.env,
        isTTY: Boolean(this.stdout.isTTY),
        columns: this.stdout.columns,
        rows: this.stdout.rows,
        platform: process.platform,
      }),
      this.overrides,
    );
  }

  get acquired(): AcquiredState | null {
    return this.state;
  }

  size(): Size {
    return {
      width: this.stdout.columns ?? 80,
      height: this.stdout.rows ?? 24,
    };
  }

  capabilities(): TerminalCapabilities {
    return this.caps;
  }

  setCapabilityOverrides(overrides: CapabilityOverrides): void {
    this.overrides = { ...this.overrides, ...overrides };
    this.caps = this.detect();
  }

  environment(): Record<string, string> {
    return describeEnvironment({
      env: this.env,
      isTTY: Boolean(this.stdout.isTTY),
      columns: this.stdout.columns,
      rows: this.stdout.rows,
    });
  }

  acquire(options: TerminalSessionOptions): AcquiredState {
    if (this.state) return this.state;

    const caps = this.caps;
    const managed = options.managed ?? true;
    const state: AcquiredState = { ...NOTHING_ACQUIRED };
    const out: string[] = [];

    if (this.stdin.isTTY && typeof this.stdin.setRawMode === 'function' && !this.stdin.isRaw) {
      this.stdin.setRawMode(true);
      state.rawMode = true;
    }

    if (managed && (options.altScreen ?? true) && caps.altScreen) {
      out.push(ansi.altScreenEnter, ansi.eraseScreen, ansi.cursorHome);
      state.altScreen = true;
    }

    if ((options.hideCursor ?? true) && caps.cursor) {
      out.push(ansi.cursorHide);
      state.cursorHidden = true;
    }

    if ((options.mouse ?? false) && caps.mouse) {
      out.push((options.wheel ?? true) ? ansi.mouseOn : ansi.mouseButtonsOn);
      state.mouse = true;
      state.wheel = options.wheel ?? true;
    }

    if ((options.focusEvents ?? false) && caps.focusEvents) {
      out.push(ansi.focusEventsOn);
      state.focusEvents = true;
    }

    if ((options.paste ?? true) && caps.paste) {
      out.push(ansi.bracketedPasteOn);
      state.paste = true;
    }

    if ((options.enhancedKeys ?? false) && caps.kittyKeyboard) {
      out.push(ansi.kittyKeyboardPush);
      state.enhancedKeys = true;
    }

    if (options.title && caps.title) {
      out.push(ansi.setTitle(options.title));
      state.titleSet = true;
    }

    this.stdout.write(out.join(''));

    this.decoder = createDecoder(
      (event) => {
        for (const fn of [...this.inputListeners]) fn(event);
      },
      { escapeTimeoutMs: this.options.escapeTimeoutMs },
    );

    this.stdin.setEncoding('utf8');
    this.stdin.on('data', this.onStdinData);
    this.stdin.resume();
    this.stdout.on('resize', this.handleResize);

    if (this.options.installExitHandlers ?? true) this.installExitHandlers();

    this.state = state;
    return state;
  }

  /**
   * Undo exactly what was acquired, in reverse. Anything this adapter did not
   * turn on is left alone - that is what makes an embedded session safe.
   */
  release(): void {
    const state = this.state;
    if (!state) return;
    this.state = null;

    const out: string[] = [];
    if (state.enhancedKeys) out.push(ansi.kittyKeyboardPop);
    if (state.paste) out.push(ansi.bracketedPasteOff);
    if (state.focusEvents) out.push(ansi.focusEventsOff);
    if (state.mouse) out.push(state.wheel ? ansi.mouseOff : ansi.mouseButtonsOff);
    if (state.altScreen) out.push(ansi.altScreenLeave);
    if (state.cursorHidden) out.push(ansi.cursorShow);
    if (state.cursorShaped) out.push(ansi.cursorShapeReset);
    out.push(ansi.reset);

    try {
      this.stdout.write(out.join(''));
    } catch {
      // The stream may already be closed during an abrupt exit.
    }

    this.stdin.off('data', this.onStdinData);
    this.stdout.off('resize', this.handleResize);
    this.decoder?.reset();
    this.decoder = null;

    if (state.rawMode && this.stdin.isTTY && typeof this.stdin.setRawMode === 'function') {
      try {
        this.stdin.setRawMode(false);
      } catch {
        /* best effort */
      }
    }
    this.stdin.pause();
    this.removeExitHandlers();
  }

  write(data: string): void {
    if (data === '') return;
    this.pending.push(data);
  }

  flush(): void {
    if (this.pending.length === 0) return;
    const data = this.pending.join('');
    this.pending = [];
    this.stdout.write(data);
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
    if (!this.caps.clipboard) return;
    this.stdout.write(ansi.clipboardWrite(text));
  }

  setTitle(title: string): void {
    if (!this.caps.title) return;
    this.stdout.write(ansi.setTitle(title));
  }

  setCursorShape(shape: CursorStyle): void {
    // No session means nothing to put back, and nothing that would put it
    // back - so a shape set outside one is a shape left on the user's shell.
    if (!this.caps.cursor || !this.state) return;
    this.stdout.write(ansi.cursorShape(shape));
    this.state.cursorShaped = true;
  }

  private installExitHandlers(): void {
    this.exitHandler = () => this.release();
    process.on('exit', this.exitHandler);

    this.signalHandler = (signal: TerminalSignal) => {
      this.release();
      process.exit(signal === 'SIGINT' ? 130 : 143);
    };
    process.on('SIGINT', this.signalHandler);
    process.on('SIGTERM', this.signalHandler);
    process.on('SIGHUP', this.signalHandler);
  }

  private removeExitHandlers(): void {
    if (this.exitHandler) {
      process.off('exit', this.exitHandler);
      this.exitHandler = null;
    }
    if (this.signalHandler) {
      process.off('SIGINT', this.signalHandler);
      process.off('SIGTERM', this.signalHandler);
      process.off('SIGHUP', this.signalHandler);
      this.signalHandler = null;
    }
  }

  dispose(): void {
    this.release();
    this.inputListeners.clear();
    this.resizeListeners.clear();
  }
}

export function createNodeTerminal(options?: NodeAdapterOptions): NodeTerminalAdapter {
  return new NodeTerminalAdapter(options);
}
