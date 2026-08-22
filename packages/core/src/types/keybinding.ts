import type { Disposable } from './disposable.js';
import type { WhenClause } from './when.js';
import type { KeyEvent } from './input.js';

/**
 * A chord string: `ctrl+p`, `ctrl+k ctrl+s` (a sequence), `shift+tab`, `g g`.
 * Names match `KeyName`; modifiers are ctrl/alt/shift/meta in that order.
 */
export type Chord = string;

export interface KeybindingDefinition {
  keys: Chord;
  commandId: string;
  args?: Record<string, unknown>;
  /**
   * What *this key* does, when the command's own title does not say it.
   *
   * A binding that carries arguments runs one invocation of a command, not the
   * command: `ctrl+b` is "Toggle Sidebar" and the command is "Toggle Surface".
   * Without this the shortcut sheet files the key under the general title and
   * says something that is not true of the key.
   */
  title?: string;
  when?: WhenClause;
  /** Only fires while this focus scope (or one inside it) is active. */
  scopeId?: string;
  /** Higher wins on conflict. Defaults to registration order. */
  priority?: number;
}

export interface KeybindingRegistry {
  register(def: KeybindingDefinition): Disposable;
  unregister(keys: Chord, commandId?: string): void;
  list(): KeybindingDefinition[];
  /**
   * Chords bound to a command, for rendering hints next to menu rows.
   *
   * Argument-bearing bindings are left out: they run one invocation and not
   * the command, so offering one as *the* key for the command's menu row
   * names a key that does something else. Match on `args` through `list()`
   * when the specific invocation is what is wanted.
   */
  forCommand(commandId: string): Chord[];
  /**
   * Feed a key in. Returns 'handled', 'pending' (a prefix of a longer chord),
   * or 'unhandled'.
   */
  handle(event: KeyEvent): 'handled' | 'pending' | 'unhandled';
  /** Abandon a partially typed chord. */
  reset(): void;
}
