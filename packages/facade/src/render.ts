import { createApp, WRITER_KEY } from '@textui/core';
import type { ComponentNode, CreateAppOptions, TerminalAdapter, TextUIApp } from '@textui/core';
import { createNodeTerminal, createWriter } from '@textui/terminal';
import type { NodeAdapterOptions } from '@textui/terminal';

/**
 * Mount a component on the terminal and keep it there.
 *
 * `createApp(...).start()` is what this is, with the two lines of ceremony
 * that every program repeated - build a terminal, hand it the root - moved
 * behind the call. The app is still on the handle, because everything past
 * hello world is reached through it.
 *
 * One-shot rendering is `renderOnce` and `renderToString`. This one runs.
 */

export interface RenderOptions extends Omit<CreateAppOptions, 'terminal' | 'root'> {
  /** Render onto this instead of the process's terminal. */
  terminal?: TerminalAdapter;
  stdin?: NodeAdapterOptions['stdin'];
  stdout?: NodeAdapterOptions['stdout'];
  /**
   * Unmount on ctrl+c. On by default.
   *
   * It has to be handled as a key, not a signal. The terminal is in raw mode
   * from the moment the app starts, and raw mode is precisely the mode where
   * ctrl+c stops being SIGINT and becomes the byte 0x03 - so the process
   * signal handlers never fire, and an application that does not read the key
   * cannot be quit from the keyboard at all.
   *
   * Turn it off to handle the key yourself: an editor with unsaved work should
   * ask rather than obey.
   */
  exitOnCtrlC?: boolean;
}

export interface RenderHandle {
  /** Commands, themes, focus, the store - everything hello world did not need. */
  app: TextUIApp;
  /** Resolves when the application stops, however it stopped. */
  waitUntilExit(): Promise<void>;
  /** Stop, put the terminal back, and resolve `waitUntilExit`. */
  unmount(): Promise<void>;
  /** Swap the root for another node. */
  rerender(node: ComponentNode): void;
}

export function render(node: ComponentNode, options: RenderOptions = {}): RenderHandle {
  const { terminal: given, stdin, stdout, exitOnCtrlC = true, ...rest } = options;
  const terminal = given ?? createNodeTerminal({
    ...(stdin ? { stdin } : {}),
    ...(stdout ? { stdout } : {}),
  });

  const app = createApp({ ...rest, terminal, root: node });

  // Every application wrote this line and none of them had a choice about it:
  // without a writer the app renders frames and puts none of them anywhere.
  // Provide it again afterwards to use your own.
  app.services.provide(WRITER_KEY, createWriter(terminal.capabilities()));

  let settle: (() => void) | undefined;
  let fail: ((err: unknown) => void) | undefined;
  const exited = new Promise<void>((resolve, reject) => { settle = resolve; fail = reject; });
  let stopping: Promise<void> | null = null;

  const unmount = (): Promise<void> => {
    stopping ??= app.stop().then(() => { settle?.(); }, (err: unknown) => { fail?.(err); });
    return stopping;
  };

  // Before `start`, so this sees the key first. That ordering is the whole
  // difference between "ctrl+c quits" and "ctrl+c quits unless something else
  // got there", and a program you cannot leave is worse than one that leaves
  // too eagerly - `exitOnCtrlC: false` is there for the other case.
  if (exitOnCtrlC) {
    terminal.onInput((event) => {
      if (event.type === 'key' && event.ctrl && event.name === 'c') void unmount();
    });
  }

  app.start().catch((err: unknown) => { fail?.(err); });

  return {
    app,
    waitUntilExit: () => exited,
    unmount,
    rerender(next) {
      app.setRoot(next);
    },
  };
}
