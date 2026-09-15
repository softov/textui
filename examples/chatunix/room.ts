// The room: a transport and a wire format, with no screen in it.
//
// Split out from `index.ts` so it can be tested without a terminal - two
// clients and a server in one process, over a socket in a temp directory, and
// no sleeping.

import { createServer, connect, type Server, type Socket } from 'node:net';
import { unlink } from 'node:fs/promises';
import { platform } from 'node:process';

/** What a room address can be: a filesystem path, or `host:port`. */
export type Address = { kind: 'unix'; path: string } | { kind: 'tcp'; host: string; port: number };

export interface Message {
  from: string;
  text: string;
  /** Milliseconds, from whoever sent it. Clocks are not synchronised. */
  at: number;
}

export type Role = 'server' | 'client';

export interface Room {
  role: Role;
  address: Address;
  /** Everyone connected, as the server sees it. For a client, the count the room greeted it with. */
  peers(): number;
  say(text: string): void;
  onMessage(fn: (message: Message) => void): void;
  onPeers(fn: (count: number) => void): void;
  close(): Promise<void>;
}

/**
 * `--path /tmp/room` is a socket; `--path 127.0.0.1:7000` is a port.
 *
 * The colon is the whole test, and a path is allowed to contain one - so the
 * part after the last colon has to be a number for this to be a port, which
 * also makes `./weird:name` a path rather than an error. An empty host means
 * loopback, so `:7000` is the short way to say the usual thing.
 */
export function parseAddress(value: string): Address {
  const colon = value.lastIndexOf(':');
  if (colon >= 0) {
    const port = Number(value.slice(colon + 1));
    if (Number.isInteger(port) && port > 0 && port < 65536) {
      return { kind: 'tcp', host: value.slice(0, colon) || '127.0.0.1', port };
    }
  }
  return { kind: 'unix', path: value };
}

export const describeAddress = (a: Address): string =>
  a.kind === 'unix' ? a.path : `${a.host}:${a.port}`;

/**
 * What `net` is actually told to open for a path.
 *
 * On Windows a local socket is a named pipe, and a pipe is named under
 * `\\.\pipe\` rather than anywhere on disk - `listen('C:\tmp\room')` is
 * refused outright. The path still names the room, so two people who type
 * the same `--path` meet; it is folded into one pipe name rather than used
 * as a file. Everywhere else the path is the socket file, as it says.
 */
export function endpointOf(path: string): string {
  if (platform !== 'win32') return path;
  return `\\\\.\\pipe\\chatunix-${path.replace(/[\\/:]+/g, '-')}`;
}

/**
 * One JSON-RPC notification per line.
 *
 * `say` carries a message. `hello` is the room's greeting to whoever just
 * arrived, and it is what makes "joined" mean *the room has you* rather than
 * *the connection opened*: on a named pipe the host learns of an arrival a
 * turn after the arrival learns of the host, and a client that counted itself
 * in before then was in nobody's count.
 */
type Notification =
  | { jsonrpc: '2.0'; method: 'say'; params: Message }
  | { jsonrpc: '2.0'; method: 'hello'; params: { peers: number } };

const encode = (message: Message): string =>
  `${JSON.stringify({ jsonrpc: '2.0', method: 'say', params: message } satisfies Notification)}\n`;

const greet = (peers: number): string =>
  `${JSON.stringify({ jsonrpc: '2.0', method: 'hello', params: { peers } } satisfies Notification)}\n`;

/**
 * Read whole lines out of a socket.
 *
 * A socket delivers bytes, not messages: two sends can arrive as one chunk and
 * one send can arrive as three. Anything that parses a chunk as JSON works
 * until the day it does not.
 */
function lines(socket: Socket, onLine: (line: string) => void): void {
  let buffer = '';
  socket.setEncoding('utf8');
  socket.on('data', (chunk: string) => {
    buffer += chunk;
    let cut = buffer.indexOf('\n');
    while (cut >= 0) {
      const line = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 1);
      if (line.trim()) onLine(line);
      cut = buffer.indexOf('\n');
    }
  });
}

type Parsed = { kind: 'say'; message: Message } | { kind: 'hello'; peers: number } | null;

const parse = (line: string): Parsed => {
  try {
    const value = JSON.parse(line) as { method?: unknown; params?: Record<string, unknown> };
    const p = value.params;
    if (!p) return null;
    if (value.method === 'hello') return { kind: 'hello', peers: typeof p.peers === 'number' ? p.peers : 0 };
    if (value.method !== 'say' || typeof p.from !== 'string' || typeof p.text !== 'string') return null;
    return { kind: 'say', message: { from: p.from, text: p.text, at: typeof p.at === 'number' ? p.at : Date.now() } };
  } catch {
    return null;
  }
};

export interface JoinOptions {
  address: Address;
  name: string;
  /** Milliseconds to wait for a connection before deciding to host. */
  timeoutMs?: number;
}

/**
 * Join the room, or become it.
 *
 * There is no `--server` flag: whoever arrives first hosts. Connecting is
 * tried before hosting, because the other way round races - two people
 * starting together would both find nothing and both bind.
 *
 * A socket file outlives the process that made it, so a crash leaves one
 * behind that looks exactly like a running room until you connect to it and
 * are refused. That is the case worth handling, and it is why the refusal
 * unlinks rather than reports.
 */
export async function joinRoom(options: JoinOptions): Promise<Room> {
  const { address, name } = options;
  try {
    return await asClient(address, name, options.timeoutMs ?? 2000);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException | undefined)?.code;
    if (code !== 'ECONNREFUSED' && code !== 'ENOENT') throw err;
    if (address.kind === 'unix') await unlink(address.path).catch(() => undefined);
    return asServer(address, name);
  }
}

function asClient(address: Address, name: string, timeoutMs: number): Promise<Room> {
  return new Promise<Room>((resolve, reject) => {
    const socket = address.kind === 'unix'
      ? connect({ path: endpointOf(address.path) })
      : connect({ host: address.host, port: address.port });

    const listeners: ((m: Message) => void)[] = [];
    socket.setTimeout(timeoutMs);
    socket.once('error', reject);
    socket.once('timeout', () => { socket.destroy(); reject(new Error('timed out')); });

    // Connected is not joined. The room says hello once it has counted the
    // arrival, and that is the line this resolves on; a stale socket file
    // refuses before then, and a host that never greets is a timeout.
    let peers = 0;
    let joined = false;
    lines(socket, (line) => {
      const parsed = parse(line);
      if (!parsed) return;
      if (parsed.kind === 'hello') {
        peers = parsed.peers;
        if (joined) return;
        joined = true;
        socket.setTimeout(0);
        socket.removeListener('error', reject);
        socket.on('error', () => undefined);
        resolve({
          role: 'client',
          address,
          peers: () => peers,
          say(text) { socket.write(encode({ from: name, text, at: Date.now() })); },
          onMessage(fn) { listeners.push(fn); },
          onPeers() { /* only the server counts */ },
          close: () => new Promise((done) => { socket.end(() => { done(); }); }),
        });
        return;
      }
      for (const fn of listeners) fn(parsed.message);
    });
  });
}

function asServer(address: Address, name: string): Promise<Room> {
  return new Promise<Room>((resolve, reject) => {
    const sockets = new Set<Socket>();
    const listeners: ((m: Message) => void)[] = [];
    const peerListeners: ((n: number) => void)[] = [];
    const announce = (): void => { for (const fn of peerListeners) fn(sockets.size); };

    // To everyone, including whoever sent it: the sender's own screen then
    // shows what the room saw rather than what it typed, so a message that
    // did not arrive does not appear to have.
    const broadcast = (message: Message): void => {
      const line = encode(message);
      for (const socket of sockets) socket.write(line);
      for (const fn of listeners) fn(message);
    };

    const server: Server = createServer((socket) => {
      sockets.add(socket);
      announce();
      socket.on('error', () => undefined);
      socket.on('close', () => { sockets.delete(socket); announce(); });
      socket.write(greet(sockets.size));
      lines(socket, (line) => {
        const parsed = parse(line);
        if (parsed?.kind === 'say') broadcast(parsed.message);
      });
    });

    server.once('error', reject);
    const done = (): void => {
      server.removeListener('error', reject);
      server.on('error', () => undefined);
      resolve({
        role: 'server',
        address,
        peers: () => sockets.size,
        say(text) { broadcast({ from: name, text, at: Date.now() }); },
        onMessage(fn) { listeners.push(fn); },
        onPeers(fn) { peerListeners.push(fn); },
        close: () => new Promise((closed) => {
          for (const socket of sockets) socket.destroy();
          sockets.clear();
          server.close(() => { closed(); });
        }),
      });
    };

    if (address.kind === 'unix') server.listen(endpointOf(address.path), done);
    else server.listen(address.port, address.host, done);
  });
}
