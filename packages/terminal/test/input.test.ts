import { describe, expect, it } from 'vitest';
import { createDecoder } from '../src/input.js';
import type { InputEvent, KeyEvent, MouseEvent } from '@textui/core';

const ESC = '\x1b';

function collect(): { events: InputEvent[]; feed(s: string): void } {
  const events: InputEvent[] = [];
  const decoder = createDecoder((e) => events.push(e), { escapeTimeoutMs: 0 });
  return { events, feed: (s) => decoder.feed(s) };
}

function keys(events: InputEvent[]): KeyEvent[] {
  return events.filter((e): e is KeyEvent => e.type === 'key');
}

describe('printable keys', () => {
  it('names the space bar, and still calls it a character', () => {
    const c = collect();
    c.feed(' ');
    // Both, and both matter. `KeyName` lists `space` and every control that
    // toggles tests for it, so a terminal that sent `' '` meant none of them
    // ever fired; and a field that inserts `event.char` still has to be able
    // to insert a space.
    expect(keys(c.events)[0]).toMatchObject({ name: 'space', char: ' ' });
  });

  it('decodes a plain character', () => {
    const c = collect();
    c.feed('a');
    expect(keys(c.events)[0]).toMatchObject({ name: 'a', char: 'a', ctrl: false, alt: false });
  });

  it('decodes an uppercase character as shifted', () => {
    const c = collect();
    c.feed('A');
    expect(keys(c.events)[0]).toMatchObject({ name: 'A', char: 'A', shift: true });
  });

  it('decodes several characters in one chunk', () => {
    const c = collect();
    c.feed('abc');
    expect(keys(c.events).map((k) => k.name)).toEqual(['a', 'b', 'c']);
  });

  it('decodes a multi-byte character as one key', () => {
    const c = collect();
    c.feed('日');
    expect(keys(c.events)).toHaveLength(1);
    expect(keys(c.events)[0]!.char).toBe('日');
  });
});

describe('control keys', () => {
  it('decodes ctrl+letter', () => {
    const c = collect();
    c.feed('\x03');
    expect(keys(c.events)[0]).toMatchObject({ name: 'c', ctrl: true });
  });

  it('decodes enter, tab and backspace by name', () => {
    const c = collect();
    c.feed('\r\t\x7f');
    expect(keys(c.events).map((k) => k.name)).toEqual(['enter', 'tab', 'backspace']);
  });

  it('decodes a lone escape', () => {
    const c = collect();
    c.feed(ESC);
    c.feed('x');
    // ESC + x is alt+x, not escape then x
    expect(keys(c.events)[0]).toMatchObject({ name: 'x', alt: true });
  });

  it('decodes alt+letter', () => {
    const c = collect();
    c.feed(`${ESC}b`);
    expect(keys(c.events)[0]).toMatchObject({ name: 'b', alt: true });
  });
});

describe('csi sequences', () => {
  it('decodes the arrow keys', () => {
    const c = collect();
    c.feed(`${ESC}[A${ESC}[B${ESC}[D${ESC}[C`);
    expect(keys(c.events).map((k) => k.name)).toEqual(['up', 'down', 'left', 'right']);
  });

  it('decodes modified arrows', () => {
    const c = collect();
    c.feed(`${ESC}[1;5A`);
    expect(keys(c.events)[0]).toMatchObject({ name: 'up', ctrl: true });
  });

  it('decodes home, end, page up and page down', () => {
    const c = collect();
    c.feed(`${ESC}[H${ESC}[F${ESC}[5~${ESC}[6~`);
    expect(keys(c.events).map((k) => k.name)).toEqual(['home', 'end', 'pageup', 'pagedown']);
  });

  it('decodes function keys', () => {
    const c = collect();
    c.feed(`${ESC}OP${ESC}[15~`);
    expect(keys(c.events).map((k) => k.name)).toEqual(['f1', 'f5']);
  });

  it('decodes shift+tab', () => {
    const c = collect();
    c.feed(`${ESC}[Z`);
    expect(keys(c.events)[0]).toMatchObject({ name: 'tab', shift: true });
  });

  it('waits for an incomplete sequence instead of guessing', () => {
    const c = collect();
    c.feed(`${ESC}[`);
    expect(c.events).toHaveLength(0);
    c.feed('A');
    expect(keys(c.events)[0]!.name).toBe('up');
  });

  it('handles a sequence split across three reads', () => {
    const c = collect();
    c.feed(ESC);
    c.feed('[1;');
    c.feed('5C');
    expect(keys(c.events)[0]).toMatchObject({ name: 'right', ctrl: true });
  });
});

describe('mouse', () => {
  const mouse = (events: InputEvent[]): MouseEvent[] =>
    events.filter((e): e is MouseEvent => e.type === 'mouse');

  it('decodes a left click', () => {
    const c = collect();
    c.feed(`${ESC}[<0;10;5M`);
    expect(mouse(c.events)[0]).toMatchObject({ action: 'down', button: 'left', x: 9, y: 4 });
  });

  it('decodes a release', () => {
    const c = collect();
    c.feed(`${ESC}[<0;10;5m`);
    expect(mouse(c.events)[0]).toMatchObject({ action: 'up', button: 'left' });
  });

  it('decodes wheel up and down', () => {
    const c = collect();
    c.feed(`${ESC}[<64;1;1M${ESC}[<65;1;1M`);
    const [up, down] = mouse(c.events);
    expect(up).toMatchObject({ action: 'wheel', wheel: -1 });
    expect(down).toMatchObject({ action: 'wheel', wheel: 1 });
  });

  it('decodes a drag', () => {
    const c = collect();
    c.feed(`${ESC}[<32;4;9M`);
    expect(mouse(c.events)[0]).toMatchObject({ action: 'drag', button: 'left', x: 3, y: 8 });
  });

  it('decodes modifiers on a click', () => {
    const c = collect();
    c.feed(`${ESC}[<16;2;2M`);
    expect(mouse(c.events)[0]).toMatchObject({ ctrl: true });
  });
});

describe('paste and focus', () => {
  it('decodes bracketed paste as one event', () => {
    const c = collect();
    c.feed(`${ESC}[200~hello world${ESC}[201~`);
    expect(c.events).toHaveLength(1);
    expect(c.events[0]).toMatchObject({ type: 'paste', text: 'hello world' });
  });

  it('does not read pasted text as keystrokes', () => {
    const c = collect();
    c.feed(`${ESC}[200~a${ESC}[Ab${ESC}[201~`);
    expect(keys(c.events)).toHaveLength(0);
    expect(c.events[0]).toMatchObject({ type: 'paste' });
  });

  it('handles a paste split across reads', () => {
    const c = collect();
    c.feed(`${ESC}[200~part one `);
    expect(c.events).toHaveLength(0);
    c.feed(`part two${ESC}[201~`);
    expect(c.events[0]).toMatchObject({ type: 'paste', text: 'part one part two' });
  });

  it('decodes terminal focus in and out', () => {
    const c = collect();
    c.feed(`${ESC}[I${ESC}[O`);
    expect(c.events).toEqual([
      { type: 'terminal-focus', focused: true },
      { type: 'terminal-focus', focused: false },
    ]);
  });
});

describe('kitty keyboard', () => {
  it('decodes a disambiguated key', () => {
    const c = collect();
    c.feed(`${ESC}[105;5u`);
    expect(keys(c.events)[0]).toMatchObject({ char: 'i', ctrl: true });
  });

  it('tells ctrl+enter from enter', () => {
    // The whole point of asking for the protocol. Without it both are 0x0d,
    // so a composer cannot offer "enter sends, ctrl+enter is a newline" - the
    // two keys are the same key.
    const c = collect();
    c.feed(`${ESC}[13u`);
    c.feed(`${ESC}[13;5u`);
    c.feed(`${ESC}[13;3u`);
    expect(keys(c.events)).toMatchObject([
      { name: 'enter', ctrl: false, alt: false },
      { name: 'enter', ctrl: true },
      { name: 'enter', alt: true },
    ]);
  });

  it('still names the keys that arrive as codepoints', () => {
    // Escape, tab and backspace all come through in this form once the
    // protocol is on, and a decoder that reported them as characters would
    // break every one of them at once.
    const c = collect();
    c.feed(`${ESC}[27u`);
    c.feed(`${ESC}[9u`);
    c.feed(`${ESC}[127u`);
    expect(keys(c.events).map((k) => k.name)).toEqual(['escape', 'tab', 'backspace']);
  });
});

/**
 * A control byte after ESC.
 *
 * `alt+enter` is ESC then 0x0d, and 0x0d is the enter key - not ctrl+m. These
 * were all being reported with `ctrl` beside them, which filed them as strokes
 * nobody binds and made them unreachable: the application had `alt+enter` and
 * the terminal was sending `ctrl+alt+enter`.
 */
describe('alt and a named key', () => {
  it('decodes alt+enter without inventing a ctrl', () => {
    const c = collect();
    c.feed(`${ESC}\r`);
    expect(keys(c.events)[0]).toMatchObject({ name: 'enter', alt: true, ctrl: false });
  });

  it('decodes alt+tab and alt+backspace the same way', () => {
    const c = collect();
    c.feed(`${ESC}\t${ESC}\x7f`);
    expect(keys(c.events).map((k) => [k.name, k.alt, k.ctrl]))
      .toEqual([['tab', true, false], ['backspace', true, false]]);
  });

  it('keeps ctrl where the byte really is a ctrl+letter', () => {
    const c = collect();
    c.feed(`${ESC}\x01`);
    expect(keys(c.events)[0]).toMatchObject({ name: 'a', alt: true, ctrl: true });
  });

  it('and for ctrl+space, which is the one named byte that is a chord', () => {
    const c = collect();
    c.feed(`${ESC}\x00`);
    expect(keys(c.events)[0]).toMatchObject({ name: 'space', alt: true, ctrl: true });
  });
});

describe('ctrl+enter, in every encoding a terminal has for it', () => {
  it('tells a bare LF from a CR', () => {
    // The legacy encoding, and the one the composer actually met: enter is CR
    // and ctrl+enter is LF. Both were `enter` with no modifier, so they were
    // one key and the newline was unreachable.
    const c = collect();
    c.feed('\r');
    c.feed('\n');
    expect(keys(c.events)).toMatchObject([
      { name: 'enter', ctrl: false },
      { name: 'enter', ctrl: true },
    ]);
  });

  it('decodes xterm modifyOtherKeys', () => {
    // CSI 27 ; mod ; codepoint ~ - what a terminal that will not do the kitty
    // protocol sends instead. 27 is not a `CSI_NUMBERS` entry, so this used to
    // match nothing and emit nothing at all: the key was not misread, it was
    // dropped.
    const c = collect();
    c.feed(`${ESC}[27;5;13~`);
    c.feed(`${ESC}[27;3;13~`);
    c.feed(`${ESC}[27;1;13~`);
    expect(keys(c.events)).toMatchObject([
      { name: 'enter', ctrl: true },
      { name: 'enter', alt: true },
      { name: 'enter', ctrl: false, alt: false },
    ]);
  });

  it('leaves the keys that share the tilde form alone', () => {
    // The new branch is keyed on 27 and must not shadow the numbered keys
    // that also end in `~`.
    const c = collect();
    c.feed(`${ESC}[3~`);
    c.feed(`${ESC}[5;5~`);
    expect(keys(c.events)).toMatchObject([
      { name: 'delete' },
      { name: 'pageup', ctrl: true },
    ]);
  });

  it('still reads a paste that contains newlines as a paste', () => {
    // The LF rule is in `stepPlain`, and pasted text never goes through it -
    // otherwise pasting two lines would fire two ctrl+enters.
    const c = collect();
    c.feed(`${ESC}[200~one\ntwo${ESC}[201~`);
    expect(c.events).toMatchObject([{ type: 'paste', text: 'one\ntwo' }]);
    expect(keys(c.events)).toHaveLength(0);
  });
});
