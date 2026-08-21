import { createWriteStream } from 'node:fs';
import { connect } from 'node:net';
import type { BindingPath, Disposable, EventPath, TextUIApp } from '@textui/core';
import { createBag } from '@textui/core';

/**
 * Where the log goes, and what goes into it.
 *
 * A terminal application cannot print its own diagnostics: the screen is the
 * output. So the log leaves the process - to a file, or down a unix socket to
 * something watching. `examples/logtail.mjs` is the something.
 *
 * What is recorded is deliberately the runtime's own vocabulary rather than a
 * narration written at each call site. Focus moved, a command ran, a surface
 * changed - those are facts the runtime already publishes, and a log built
 * from them cannot drift from what actually happened.
 */

export interface LogSink {
  write(record: Record<string, unknown>): void;
  close(): void;
}

/** One JSON object per line, which is greppable and streamable. */
function jsonl(write: (line: string) => void, close: () => void): LogSink {
  const started = Date.now();
  return {
    write(record) {
      try {
        write(`${JSON.stringify({ t: Date.now() - started, ...record })}\n`);
      } catch {
        // A log that throws takes the application with it. It does not.
      }
    },
    close,
  };
}

export function fileSink(path: string): LogSink {
  const stream = createWriteStream(path, { flags: 'a' });
  return jsonl((line) => stream.write(line), () => stream.end());
}

/**
 * A sink that talks to whatever is listening on a unix socket.
 *
 * Buffered until the connection is up and dropped if it never comes, because a
 * missing listener is a reason to have no log, not a reason to have no editor.
 */
export function unixSink(path: string): LogSink {
  let ready = false;
  let dead = false;
  const queue: string[] = [];
  const socket = connect(path);

  socket.on('connect', () => {
    ready = true;
    for (const line of queue.splice(0)) socket.write(line);
  });
  socket.on('error', () => { dead = true; queue.length = 0; });

  return jsonl(
    (line) => {
      if (dead) return;
      if (ready) socket.write(line); else queue.push(line);
    },
    () => { if (!dead) socket.end(); },
  );
}

export interface LogOptions {
  /** Also record every store write under the watched roots, not just focus. */
  verbose?: boolean;
}

/** Store roots worth a line each. */
const WATCHED: BindingPath[] = [
  '$/focus' as BindingPath,
  '$/ui' as BindingPath,
  '$/layout/surfaces' as BindingPath,
];

/**
 * Point an application at a sink.
 *
 * Returns a disposable, so a host that stops logging stops paying for it -
 * every subscription here is a real subscription and a log left attached to a
 * dead app is a leak.
 */
export function attachLog(app: TextUIApp, sink: LogSink, options: LogOptions = {}): Disposable {
  const bag = createBag();

  // A subtree subscription hands back the value at the path it was made on,
  // not at the path that changed - so the log would report the whole of
  // `$/focus` under the heading `$/focus/id`. Read what actually moved.
  const at = (path: BindingPath): unknown => app.store.get(path);

  for (const root of WATCHED) {
    bag.add(app.store.subscribe(root, (_value, change) => {
      sink.write({ kind: 'store', path: change.path, value: at(change.path) });
    }, { subtree: true }));
  }

  // Everything the runtime announces: commands, input, whatever a component
  // emits. One subscription, because `@/` is a tree.
  bag.add(app.events.on('@/' as EventPath, (payload, path) => {
    sink.write({ kind: 'event', path, payload });
  }, { subtree: true }));

  if (options.verbose) {
    bag.add(app.store.subscribe('$/' as BindingPath, (_value, change) => {
      sink.write({ kind: 'store*', path: change.path, value: at(change.path) });
    }, { subtree: true }));
  }

  sink.write({ kind: 'attached', theme: app.theme.id, verbose: options.verbose === true });
  bag.add({ dispose: () => sink.close() });
  return bag;
}
