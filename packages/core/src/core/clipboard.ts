import type { BindingPath } from '../types/graph.js';
import type { ReactiveStore } from '../types/store.js';
import type { TerminalAdapter } from '../types/terminal.js';

/**
 * The clipboard.
 *
 * A terminal can be *told* what to put on the system clipboard - OSC 52 - and
 * cannot be asked what is on it. The read half of that sequence is a way for
 * anything with a pty to read whatever you last copied, so terminals worth
 * using refuse it, and the ones that answer are the ones you would not want
 * to. So a copy goes two places: out to the system clipboard, where the rest
 * of the desktop can reach it, and into the store, which is the half a paste
 * can read back.
 *
 * That makes the store the clipboard as far as this application is concerned.
 * It is in the session scope because a clipboard is not worth persisting and
 * is worth surviving a screen change.
 */
export const CLIPBOARD_PATH = '$/session/clipboard' as BindingPath;

export function readClipboard(store: ReactiveStore): string {
  return store.get<string>(CLIPBOARD_PATH) ?? '';
}

/**
 * Put text on the clipboard.
 *
 * The terminal is optional because the store half is the half that has to
 * work: a session with no OSC 52 - a plain console, a pipe, the test harness -
 * still copies and pastes within the application.
 */
export function writeClipboard(
  store: ReactiveStore,
  text: string,
  terminal?: TerminalAdapter | null,
): void {
  store.set(CLIPBOARD_PATH, text);
  terminal?.writeClipboard?.(text);
}
