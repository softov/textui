import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describeAddress, joinRoom, parseAddress, type Room } from '../room.ts';

const open: Room[] = [];
const track = async (room: Promise<Room>): Promise<Room> => {
  const r = await room;
  open.push(r);
  return r;
};

// Nothing here sleeps. A message arriving is an event, so the test waits for
// the event - a timeout would be slower on a fast machine and flaky on a busy
// one, which is the worst pair of properties a test can have.
const nextMessage = (room: Room): Promise<{ from: string; text: string }> =>
  new Promise((resolve) => { room.onMessage((m) => { resolve({ from: m.from, text: m.text }); }); });

afterEach(async () => {
  await Promise.all(open.splice(0).reverse().map((r) => r.close()));
});

const socketDir = async (): Promise<string> => mkdtemp(join(tmpdir(), 'chatunix-'));

describe('addresses', () => {
  it('reads a port when what follows the colon is one', () => {
    expect(parseAddress('127.0.0.1:7000')).toEqual({ kind: 'tcp', host: '127.0.0.1', port: 7000 });
    expect(parseAddress(':7000')).toEqual({ kind: 'tcp', host: '127.0.0.1', port: 7000 });
  });

  it('reads a path when it is not', () => {
    expect(parseAddress('/tmp/room')).toEqual({ kind: 'unix', path: '/tmp/room' });
    // A path is allowed to contain a colon, so the number is what decides.
    expect(parseAddress('./odd:name')).toEqual({ kind: 'unix', path: './odd:name' });
    expect(parseAddress('/tmp/room:99999')).toEqual({ kind: 'unix', path: '/tmp/room:99999' });
  });

  it('says what it is back', () => {
    expect(describeAddress(parseAddress('/tmp/room'))).toBe('/tmp/room');
    expect(describeAddress(parseAddress('localhost:80'))).toBe('localhost:80');
  });
});

describe('a room over a unix socket', () => {
  it('the first to arrive hosts, the rest are clients', async () => {
    const dir = await socketDir();
    const address = parseAddress(join(dir, 'room'));

    const ana = await track(joinRoom({ address, name: 'ana' }));
    const bob = await track(joinRoom({ address, name: 'bob' }));

    expect(ana.role).toBe('server');
    expect(bob.role).toBe('client');
    await rm(dir, { recursive: true, force: true });
  });

  it('carries a message from one client to another', async () => {
    const dir = await socketDir();
    const address = parseAddress(join(dir, 'room'));

    const host = await track(joinRoom({ address, name: 'ana' }));
    const bob = await track(joinRoom({ address, name: 'bob' }));
    const cy = await track(joinRoom({ address, name: 'cy' }));

    const atHost = nextMessage(host);
    const atCy = nextMessage(cy);
    bob.say('hello room');

    expect(await atHost).toEqual({ from: 'bob', text: 'hello room' });
    expect(await atCy).toEqual({ from: 'bob', text: 'hello room' });
    await rm(dir, { recursive: true, force: true });
  });

  // The sender hears its own message back from the room rather than printing
  // it locally, so a message that did not arrive never looks as though it did.
  it('echoes the sender through the room', async () => {
    const dir = await socketDir();
    const address = parseAddress(join(dir, 'room'));

    const host = await track(joinRoom({ address, name: 'ana' }));
    const bob = await track(joinRoom({ address, name: 'bob' }));

    const back = nextMessage(bob);
    bob.say('does this come back');
    expect(await back).toEqual({ from: 'bob', text: 'does this come back' });
    void host;
    await rm(dir, { recursive: true, force: true });
  });

  it('counts who is in the room', async () => {
    const dir = await socketDir();
    const address = parseAddress(join(dir, 'room'));
    const host = await track(joinRoom({ address, name: 'ana' }));
    expect(host.peers()).toBe(0);

    const seen: number[] = [];
    host.onPeers((n) => seen.push(n));
    await track(joinRoom({ address, name: 'bob' }));
    await track(joinRoom({ address, name: 'cy' }));

    expect(host.peers()).toBe(2);
    expect(seen).toContain(1);
    await rm(dir, { recursive: true, force: true });
  });

  // A crash leaves the socket file behind, and it looks exactly like a room
  // until you are refused by it.
  it('takes over a socket left behind by a dead process', async () => {
    const dir = await socketDir();
    const path = join(dir, 'room');
    await writeFile(path, '');

    const ana = await track(joinRoom({ address: parseAddress(path), name: 'ana' }));
    expect(ana.role).toBe('server');

    const bob = await track(joinRoom({ address: parseAddress(path), name: 'bob' }));
    expect(bob.role).toBe('client');
    await rm(dir, { recursive: true, force: true });
  });
});

describe('a room over a port', () => {
  it('works the same way', async () => {
    const address = parseAddress('127.0.0.1:59123');
    const ana = await track(joinRoom({ address, name: 'ana' }));
    const bob = await track(joinRoom({ address, name: 'bob' }));

    expect(ana.role).toBe('server');
    expect(bob.role).toBe('client');

    const atAna = nextMessage(ana);
    bob.say('over tcp');
    expect(await atAna).toEqual({ from: 'bob', text: 'over tcp' });
  });
});
