#!/usr/bin/env node
import { createServer } from 'node:net';
import { unlinkSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';

/**
 * Watch what a textui application is doing.
 *
 * A terminal application cannot print its own diagnostics, because the screen
 * is the output. So it sends them here instead:
 *
 *   node examples/logtail.mjs /tmp/textide.sock
 *   node packages/textide/dist/main.js ~/scratch --log-unix /tmp/textide.sock
 *
 * Add `--verbose` to the editor for every store write rather than only focus,
 * chrome and commands. Filter with a substring:
 *
 *   node examples/logtail.mjs /tmp/textide.sock focus
 */

const [socketPath, ...filters] = process.argv.slice(2);

if (!socketPath) {
  process.stderr.write('usage: logtail.mjs <socket-path> [filter...]\n');
  process.exit(1);
}

// A socket file outlives the process that made it, so a second run would fail
// to bind against a path nothing is listening on.
if (existsSync(socketPath)) unlinkSync(socketPath);

const DIM = '\x1b[2m';
const OFF = '\x1b[0m';
const COLOUR = {
  store: '\x1b[36m',
  'store*': '\x1b[34m',
  event: '\x1b[35m',
  attached: '\x1b[32m',
};

/** Short enough to scan, long enough to identify. */
function brief(value) {
  if (value === undefined) return '';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (text === undefined) return '';
  return text.length > 96 ? `${text.slice(0, 93)}...` : text;
}

function render(record) {
  const kind = record.kind ?? '?';
  const stamp = String(record.t ?? 0).padStart(7);
  const colour = COLOUR[kind] ?? '';
  const where = record.path ?? '';
  const what = brief(record.value ?? record.payload);
  return `${DIM}${stamp}ms${OFF} ${colour}${kind.padEnd(7)}${OFF} ${where} ${DIM}${what}${OFF}`;
}

const server = createServer((socket) => {
  process.stdout.write(`${DIM}-- connected --${OFF}\n`);
  const lines = createInterface({ input: socket });

  lines.on('line', (line) => {
    if (!line.trim()) return;
    if (filters.length > 0 && !filters.some((f) => line.includes(f))) return;
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      process.stdout.write(`${line}\n`);
      return;
    }
    process.stdout.write(`${render(record)}\n`);
  });

  socket.on('close', () => process.stdout.write(`${DIM}-- closed --${OFF}\n`));
});

server.listen(socketPath, () => {
  process.stdout.write(`${DIM}listening on ${socketPath}${OFF}\n`);
});

const cleanup = () => {
  server.close();
  if (existsSync(socketPath)) unlinkSync(socketPath);
  process.exit(0);
};
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
