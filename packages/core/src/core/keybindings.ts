import type { Chord, KeybindingDefinition, KeybindingRegistry } from '../types/keybinding.js';
import type { KeyEvent } from '../types/input.js';
import type { Disposable } from '../types/disposable.js';
import type { WhenEngine } from '../types/when.js';
import type { CommandRegistry } from '../types/command.js';
import { toDisposable } from '../util/disposable.js';

/** `ctrl+shift+p` or a sequence: `ctrl+k ctrl+s`, `g g`. */
function parseChord(chord: Chord): string[] {
  return chord.trim().split(/\s+/).map(normalizeStroke);
}

const MODIFIER = /^(ctrl|control|alt|option|shift|meta|cmd|super)\+/i;

/**
 * Split one stroke into its modifiers and its key.
 *
 * Modifiers are consumed off the front by name and whatever survives is the
 * key, verbatim. Splitting on `+` cannot work here: `+` is the separator and
 * a key, so `'+'.split('+')` loses the only thing it was asked about. Parsing
 * forwards means `+` is `+`, and `ctrl++` is ctrl and `+`.
 *
 * One parser, exported, because a chord that the test harness presses and a
 * chord that the registry stored have to agree - and two implementations of
 * one grammar disagree eventually.
 */
export function splitStroke(stroke: string): { mods: string[]; key: string } {
  const mods: string[] = [];
  let rest = stroke.trim();
  for (let match = MODIFIER.exec(rest); match !== null; match = MODIFIER.exec(rest)) {
    const [whole, name = ''] = match;
    mods.push(name.toLowerCase());
    rest = rest.slice(whole.length);
  }
  return { mods, key: rest };
}

/** The canonical stroke a chord is filed under. `strokeOf` must agree with it. */
export function normalizeStroke(stroke: string): string {
  const { mods: names, key } = splitStroke(stroke);
  const mods = new Set<string>();
  for (const name of names) {
    if (name === 'ctrl' || name === 'control') mods.add('ctrl');
    else if (name === 'alt' || name === 'option') mods.add('alt');
    else if (name === 'shift') mods.add('shift');
    else mods.add('meta');
  }
  // Shift is not part of a stroke for a single character. A terminal reports
  // shift+p as `P`, and `strokeOf` reads it back that way, so a binding filed
  // under `ctrl+shift+p` would wait for a stroke no keypress can produce.
  if ([...key].length === 1) mods.delete('shift');

  const order = ['ctrl', 'alt', 'shift', 'meta'].filter((m) => mods.has(m));
  return [...order, key.toLowerCase()].join('+');
}

export function strokeOf(event: KeyEvent): string {
  const mods: string[] = [];
  if (event.ctrl) mods.push('ctrl');
  if (event.alt) mods.push('alt');
  // Shift is implied by an uppercase character; only name it for named keys.
  if (event.shift && event.name.length > 1) mods.push('shift');
  if (event.meta) mods.push('meta');
  return [...mods, event.name.toLowerCase()].join('+');
}

/**
 * Keybindings resolve to commands, never to handlers, so the same action is
 * reachable from a chord, a menu row and the palette without three copies.
 * A partially typed chord is remembered, which is what makes `ctrl+k ctrl+s`
 * possible without blocking `ctrl+k` on its own.
 */
export class Keybindings implements KeybindingRegistry {
  private bindings: (KeybindingDefinition & { strokes: string[] })[] = [];
  private pending: string[] = [];
  private pendingTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private deps: {
      when: WhenEngine;
      commands: CommandRegistry;
      activeScopes(): string[];
      onError(err: unknown, context: string): void;
      /** How long a half-typed chord waits for its next stroke. */
      chordTimeoutMs?: number;
    },
  ) {}

  register(def: KeybindingDefinition): Disposable {
    const entry = { ...def, strokes: parseChord(def.keys) };
    this.bindings.push(entry);
    this.bindings.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    return toDisposable(() => {
      const i = this.bindings.indexOf(entry);
      if (i >= 0) this.bindings.splice(i, 1);
    });
  }

  unregister(keys: Chord, commandId?: string): void {
    const strokes = parseChord(keys).join(' ');
    this.bindings = this.bindings.filter(
      (b) => !(b.strokes.join(' ') === strokes && (commandId === undefined || b.commandId === commandId)),
    );
  }

  list(): KeybindingDefinition[] {
    return this.bindings.map(({ strokes: _strokes, ...def }) => def);
  }

  forCommand(commandId: string): Chord[] {
    return this.bindings.filter((b) => b.commandId === commandId).map((b) => b.keys);
  }

  private applicable(binding: KeybindingDefinition): boolean {
    if (!this.deps.when.evaluate(binding.when)) return false;
    if (!binding.scopeId) return true;
    return this.deps.activeScopes().includes(binding.scopeId);
  }

  handle(event: KeyEvent): 'handled' | 'pending' | 'unhandled' {
    const stroke = strokeOf(event);
    const sequence = [...this.pending, stroke];

    let sawPrefix = false;
    for (const binding of this.bindings) {
      if (!this.applicable(binding)) continue;

      const { strokes } = binding;
      if (strokes.length === sequence.length && strokes.every((s, i) => s === sequence[i])) {
        this.reset();
        void this.deps.commands
          .execute(binding.commandId, binding.args ?? {}, 'keybinding')
          .catch((err: unknown) => this.deps.onError(err, `keybinding ${binding.keys}`));
        return 'handled';
      }
      if (
        strokes.length > sequence.length &&
        sequence.every((s, i) => strokes[i] === s)
      ) {
        sawPrefix = true;
      }
    }

    if (sawPrefix) {
      this.pending = sequence;
      if (this.pendingTimer) clearTimeout(this.pendingTimer);
      this.pendingTimer = setTimeout(() => this.reset(), this.deps.chordTimeoutMs ?? 1200);
      this.pendingTimer.unref?.();
      return 'pending';
    }

    this.reset();
    return 'unhandled';
  }

  reset(): void {
    this.pending = [];
    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }
  }
}

export function createKeybindings(deps: ConstructorParameters<typeof Keybindings>[0]): Keybindings {
  return new Keybindings(deps);
}
