import type { InputEvent, KeyEvent, MouseEvent } from '@textui/core';

/**
 * Input decoding.
 *
 * A terminal delivers keys as bytes that may arrive split across reads, so the
 * decoder is a small state machine over a carry buffer rather than a parser
 * over whole strings. When a sequence is incomplete it stays in the buffer and
 * waits, which is what stops a fast paste from being read as a burst of keys.
 */

const ESC = '\x1b';

function key(name: string, partial: Partial<KeyEvent> = {}): KeyEvent {
  return {
    type: 'key',
    name,
    ctrl: false,
    alt: false,
    shift: false,
    meta: false,
    raw: partial.raw ?? name,
    handled: false,
    ...partial,
  };
}

/** CSI final byte to key name, for the `ESC [ A` family. */
const CSI_LETTERS: Record<string, string> = {
  A: 'up', B: 'down', C: 'right', D: 'left',
  E: 'center', F: 'end', H: 'home',
  P: 'f1', Q: 'f2', R: 'f3', S: 'f4',
  Z: 'tab', // shift+tab arrives as CSI Z
};

/** `ESC [ <n> ~` numbers. */
const CSI_NUMBERS: Record<number, string> = {
  1: 'home', 2: 'insert', 3: 'delete', 4: 'end', 5: 'pageup', 6: 'pagedown',
  7: 'home', 8: 'end',
  11: 'f1', 12: 'f2', 13: 'f3', 14: 'f4', 15: 'f5',
  17: 'f6', 18: 'f7', 19: 'f8', 20: 'f9', 21: 'f10',
  23: 'f11', 24: 'f12',
};

/** xterm modifier parameter: 1 + bitmask. */
function modifiers(param: number | undefined): Pick<KeyEvent, 'shift' | 'alt' | 'ctrl' | 'meta'> {
  const bits = (param ?? 1) - 1;
  return {
    shift: (bits & 1) !== 0,
    alt: (bits & 2) !== 0,
    ctrl: (bits & 4) !== 0,
    meta: (bits & 8) !== 0,
  };
}

const CTRL_NAMES: Record<number, string> = {
  0x00: 'space', // ctrl+space
  0x08: 'backspace',
  0x09: 'tab',
  0x0a: 'enter',
  0x0d: 'enter',
  0x1b: 'escape',
  0x7f: 'backspace',
};

export interface DecoderOptions {
  /** How long to wait before a lone ESC is reported as the escape key. */
  escapeTimeoutMs?: number;
}

export class InputDecoder {
  private carry = '';
  private pasting = false;
  private pasteBuffer = '';
  private escapeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private emit: (event: InputEvent) => void,
    private options: DecoderOptions = {},
  ) {}

  /** Feed raw input. Emits zero or more events. */
  feed(chunk: string): void {
    this.clearEscapeTimer();
    this.carry += chunk;

    for (;;) {
      const consumed = this.step();
      if (consumed === 0) break;
    }

    // A lone ESC is ambiguous until either more bytes arrive or time passes.
    if (this.carry === ESC) {
      this.escapeTimer = setTimeout(() => {
        if (this.carry === ESC) {
          this.carry = '';
          this.emit(key('escape', { raw: ESC }));
        }
      }, this.options.escapeTimeoutMs ?? 30);
      this.escapeTimer.unref?.();
    }
  }

  private clearEscapeTimer(): void {
    if (this.escapeTimer) {
      clearTimeout(this.escapeTimer);
      this.escapeTimer = null;
    }
  }

  /** Consume one event's worth of bytes. Returns how many were used. */
  private step(): number {
    if (this.carry === '') return 0;

    if (this.pasting) return this.stepPaste();

    const first = this.carry[0] as string;

    if (first !== ESC) return this.stepPlain();
    if (this.carry.length === 1) return 0; // wait for more

    const second = this.carry[1] as string;

    if (second === '[') return this.stepCsi();
    if (second === 'O') return this.stepSs3();

    // ESC followed by a printable character is alt+that.
    if (second !== ESC) {
      const cp = this.carry.codePointAt(1) as number;
      const char = String.fromCodePoint(cp);
      const raw = ESC + char;
      this.carry = this.carry.slice(raw.length);
      /*
       * A control byte after ESC is alt+that key - and only *also* ctrl when
       * the byte has no name of its own.
       *
       * `alt+enter` arrives as ESC then 0x0d, and 0x0d is the enter key, not
       * ctrl+m: reporting `ctrl` beside it filed the stroke as
       * `ctrl+alt+enter`, which is not what anybody binds and not what the
       * same key produces without the ESC. `stepPlain` has always had this
       * rule - `ctrl: cp === 0x00` - and this path did not, so `alt+tab`,
       * `alt+backspace` and `alt+enter` were all unreachable.
       *
       * 0x00 keeps it, because that one really is ctrl+space.
       */
      // 0x7f as well as 0x20 and below: that is the backspace most terminals
      // send, and `stepPlain` has always counted it as a control. Leaving it
      // out here made `alt+backspace` a key named "\x7f".
      const control = cp < 0x20 || cp === 0x7f;
      const named = control ? CTRL_NAMES[cp] : undefined;
      this.emit(
        control
          ? key(named ?? String.fromCharCode(cp + 96), {
              alt: true,
              ...(named === undefined || cp === 0x00 ? { ctrl: true } : {}),
              raw,
            })
          : key(char, { char, alt: true, raw, shift: char !== char.toLowerCase() }),
      );
      return raw.length;
    }

    // Two escapes: report the first as the escape key.
    this.carry = this.carry.slice(1);
    this.emit(key('escape', { raw: ESC }));
    return 1;
  }

  private stepPlain(): number {
    const cp = this.carry.codePointAt(0) as number;
    const char = String.fromCodePoint(cp);

    if (cp < 0x20 || cp === 0x7f) {
      this.carry = this.carry.slice(char.length);
      const named = CTRL_NAMES[cp];
      if (named) {
        /*
         * 0x0a is `ctrl+enter`; 0x0d is enter.
         *
         * Both were named `enter` with no modifier, which made them the same
         * key - and that is what a composer sees when it offers "enter sends,
         * ctrl+enter is a newline" and the newline never comes. In raw mode
         * the Return key sends CR: the kernel's CR-to-NL translation is off,
         * so a bare LF is not Return, it is ctrl+Return (or ctrl+j, which is
         * the same byte and therefore the same key - there is no encoding in
         * which those two differ).
         *
         * Pasted newlines do not come through here: a bracketed paste is
         * buffered whole by `stepPaste` and emitted as a paste event.
         *
         * 0x00 keeps its ctrl for the same reason it always had it: that byte
         * really is ctrl+space.
         */
        this.emit(key(named, { raw: char, ctrl: cp === 0x00 || cp === 0x0a }));
      } else {
        // 0x01..0x1a are ctrl+a .. ctrl+z
        const letter = String.fromCharCode(cp + 96);
        this.emit(key(letter, { ctrl: true, raw: char }));
      }
      return char.length;
    }

    this.carry = this.carry.slice(char.length);
    // Space is the one printable with a name, because it is the one printable
    // people bind to. `KeyName` has always listed it and `Button`, `Checkbox`,
    // `Switch` and `Select` have always tested for it - and none of them ever
    // saw it, because a terminal sends 0x20 and this named it `' '`. The
    // harness synthesised `'space'`, so every one of those tests passed while
    // nothing worked. `char` stays `' '`, so typing one still types one.
    const name = cp === 0x20 ? 'space' : char;
    this.emit(key(name, { char, raw: char, shift: char !== char.toLowerCase() && char.toLowerCase() !== char.toUpperCase() }));
    return char.length;
  }

  private stepPaste(): number {
    const end = this.carry.indexOf(`${ESC}[201~`);
    if (end === -1) {
      this.pasteBuffer += this.carry;
      const used = this.carry.length;
      this.carry = '';
      return used;
    }
    this.pasteBuffer += this.carry.slice(0, end);
    const used = end + 6;
    this.carry = this.carry.slice(used);
    this.pasting = false;
    const text = this.pasteBuffer;
    this.pasteBuffer = '';
    this.emit({ type: 'paste', text, handled: false });
    return used;
  }

  /** `ESC O P` - the application-cursor form of F1..F4 and the arrows. */
  private stepSs3(): number {
    if (this.carry.length < 3) return 0;
    const final = this.carry[2] as string;
    const raw = this.carry.slice(0, 3);
    this.carry = this.carry.slice(3);
    const name = CSI_LETTERS[final];
    if (name) this.emit(key(name, { raw }));
    return 3;
  }

  private stepCsi(): number {
    // Find the final byte: the first in the range @ to ~ after the parameters.
    let i = 2;
    while (i < this.carry.length) {
      const code = this.carry.charCodeAt(i);
      if (code >= 0x40 && code <= 0x7e) break;
      i++;
    }
    if (i >= this.carry.length) return 0; // incomplete

    const final = this.carry[i] as string;
    const body = this.carry.slice(2, i);
    const raw = this.carry.slice(0, i + 1);

    // Bracketed paste start.
    if (body === '200' && final === '~') {
      this.carry = this.carry.slice(i + 1);
      this.pasting = true;
      this.pasteBuffer = '';
      return raw.length;
    }

    // SGR mouse: CSI < b ; x ; y M|m
    if (body.startsWith('<') && (final === 'M' || final === 'm')) {
      this.carry = this.carry.slice(i + 1);
      const event = decodeSgrMouse(body.slice(1), final);
      if (event) this.emit(event);
      return raw.length;
    }

    // Terminal focus in/out.
    if (final === 'I' || final === 'O') {
      this.carry = this.carry.slice(i + 1);
      this.emit({ type: 'terminal-focus', focused: final === 'I' });
      return raw.length;
    }

    this.carry = this.carry.slice(i + 1);
    const params = body.split(';').map((p) => (p === '' ? undefined : Number.parseInt(p, 10)));

    // Kitty keyboard: CSI codepoint ; modifiers u
    if (final === 'u') {
      const cp = params[0];
      if (cp !== undefined) {
        const mods = modifiers(params[1]);
        const char = cp >= 0x20 ? String.fromCodePoint(cp) : undefined;
        const named = CTRL_NAMES[cp];
        this.emit(key(named ?? char ?? String(cp), { ...mods, char, raw }));
      }
      return raw.length;
    }

    if (final === '~') {
      /*
       * xterm's `modifyOtherKeys`: CSI 27 ; modifiers ; codepoint ~
       *
       * The *other* way a terminal can say `ctrl+enter`, and the one that was
       * going straight in the bin: 27 is not in `CSI_NUMBERS`, so
       * `CSI 27;5;13~` matched nothing, fell through every branch and the key
       * did nothing at all - not "arrived as plain enter", nothing.
       *
       * It carries the same information as the kitty form with the parameters
       * the other way round, so it decodes through the same rules. Terminals
       * that will not do the kitty protocol often do this one, which makes it
       * the difference between `ctrl+enter` existing and not.
       */
      if (params[0] === 27 && params[2] !== undefined) {
        const cp = params[2];
        const char = cp >= 0x20 ? String.fromCodePoint(cp) : undefined;
        this.emit(key(CTRL_NAMES[cp] ?? char ?? String(cp), {
          ...modifiers(params[1]),
          char,
          raw,
        }));
        return raw.length;
      }

      const name = CSI_NUMBERS[params[0] ?? 0];
      if (name) this.emit(key(name, { ...modifiers(params[1]), raw }));
      return raw.length;
    }

    const name = CSI_LETTERS[final];
    if (name) {
      if (final === 'Z') {
        this.emit(key('tab', { shift: true, raw }));
      } else {
        // CSI 1 ; mod A
        this.emit(key(name, { ...modifiers(params[1]), raw }));
      }
    }
    return raw.length;
  }

  /** Drop any half-read sequence. After releasing the terminal. */
  reset(): void {
    this.clearEscapeTimer();
    this.carry = '';
    this.pasting = false;
    this.pasteBuffer = '';
  }
}

function decodeSgrMouse(body: string, final: string): MouseEvent | null {
  const parts = body.split(';').map((p) => Number.parseInt(p, 10));
  if (parts.length < 3) return null;
  const [rawButton, col, row] = parts as [number, number, number];
  if (!Number.isFinite(rawButton) || !Number.isFinite(col) || !Number.isFinite(row)) return null;

  const shift = (rawButton & 4) !== 0;
  const alt = (rawButton & 8) !== 0;
  const ctrl = (rawButton & 16) !== 0;
  const motion = (rawButton & 32) !== 0;
  const wheel = (rawButton & 64) !== 0;
  const code = rawButton & 3;

  const base = {
    type: 'mouse' as const,
    x: col - 1,
    y: row - 1,
    ctrl, alt, shift,
    // Stamped on arrival, because nothing downstream can tell a double click
    // from two clicks without knowing when each one landed. The wire says
    // press and release and nothing else.
    at: Date.now(),
    handled: false,
  };

  if (wheel) {
    return { ...base, action: 'wheel', button: 'none', wheel: code === 0 ? -1 : 1 };
  }

  const button = code === 0 ? 'left' : code === 1 ? 'middle' : code === 2 ? 'right' : 'none';

  if (motion) {
    return {
      ...base,
      action: button === 'none' ? 'move' : 'drag',
      button: button as MouseEvent['button'],
    };
  }

  return {
    ...base,
    action: final === 'M' ? 'down' : 'up',
    button: button as MouseEvent['button'],
  };
}

export function createDecoder(
  emit: (event: InputEvent) => void,
  options?: DecoderOptions,
): InputDecoder {
  return new InputDecoder(emit, options);
}
