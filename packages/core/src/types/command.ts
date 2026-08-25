import type { Disposable } from './disposable.js';
import type { WhenClause } from './when.js';
import type { ReactiveStore } from './store.js';
import type { TextUIApp } from './app.js';

/**
 * Command scope. A command resolves from the most specific scope outward:
 *   component -> region -> screen -> app
 * The same id may be registered at several scopes; the innermost active one
 * wins, which is how `table.search` means the focused table.
 */
export type CommandScope = 'app' | 'screen' | 'region' | 'component';

/**
 * One thing an argument may be answered with.
 *
 * A bare string is the short form and stays the common one - the value is the
 * label and there is nothing else to say. The long form is for a choice that
 * has to be *explained*: an agent's approval modes are five words that all
 * sound alike ("Auto Mode", "Plan Mode") and the sentence under each one is
 * what tells them apart, which is the difference between picking and guessing.
 *
 * The command is handed `value`, never the label. A host's ids are opaque and
 * its labels are prose, and resolving one back to the other at the far end is
 * a lookup that can be wrong.
 */
export interface ArgChoice {
  value: string;
  /** What a person reads. The value, when there is nothing better. */
  label?: string;
  icon?: string;
  /** A line under it: what choosing this would mean. */
  description?: string;
}

export type ArgChoices = (string | ArgChoice)[];

export interface ArgSpec {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'unknown';
  required?: boolean;
  description?: string;
  /** Fixed choices, or a resolver for a picker. */
  choices?: ArgChoices | (() => Promise<ArgChoices> | ArgChoices);
  default?: unknown;
  /**
   * How the picker should lay out each choice's `description`.
   *
   * The argument is what knows: a list of branch names has nothing to say
   * under each one, and a list of approval modes is *only* told apart by what
   * is under each one. `below` gives every choice a second line, which is the
   * only place a sentence fits - inline it shares the width with the label and
   * every answer shows the same truncated half.
   */
  descriptions?: 'inline' | 'below';

  /**
   * Show what a choice would do, before it is chosen.
   *
   * Called as the highlight moves, and with `null` when the asking is
   * abandoned - so a theme can be applied while you look at it and put back if
   * you press escape. The command owns whatever it needs to remember to undo
   * itself; the palette only reports what is happening.
   */
  preview?(value: string | null): void;
}

export type ArgsSchema = ArgSpec[];

export interface CommandContext {
  app: TextUIApp;
  store: ReactiveStore;
  /** The scope instance the command resolved from (a region id, a node id). */
  scopeId: string | null;
  /** How it was invoked, for commands that care. */
  source: 'keybinding' | 'palette' | 'menu' | 'api' | 'mouse' | 'cli';
}

export type CommandHandler = (
  args: Record<string, unknown>,
  ctx: CommandContext,
) => unknown | Promise<unknown>;

export interface CommandDefinition {
  id: string;
  title: string;
  description?: string;
  /**
   * The group this belongs to. The palette names it once, above the group.
   *
   * It is not a per-row label: repeating it beside every row spends the width
   * the rows need for saying what they do, and still does not say where one
   * group ends and the next begins.
   */
  category?: string;
  icon?: string;
  /**
   * Leave the surface that ran this open.
   *
   * For a command whose whole effect is to flip something: closing the palette
   * after each one means reopening it to reach the next, and a list of
   * switches is meant to be walked.
   */
  keepOpen?: boolean;
  /**
   * A short state word shown beside the row, in place of its description.
   *
   * The icon is the row's identity and should not move under the reader as
   * state changes; this is where the state goes instead.
   */
  badge?: string;
  /**
   * A key hint, when it is not this command's own keybinding.
   *
   * A row built for one list may stand for a command registered under another
   * id; the binding a person would actually press belongs to that one.
   */
  shortcut?: string;
  keywords?: string[];
  scope?: CommandScope;
  /** The instance this registration belongs to, for non-app scopes. */
  scopeId?: string;
  when?: WhenClause;
  /**
   * The state of a command that is a switch, as a clause over the store.
   *
   * A toggle's row has to say what it is toggling *to*, and the definition is
   * registered once while the state changes under it - so this is a clause
   * evaluated per read, the same way `when` is, rather than a boolean nobody
   * would remember to update. Absent means the command is not a switch, which
   * a menu needs to tell apart from a switch that is off.
   */
  checked?: WhenClause;
  args?: ArgsSchema;
  /** Slots this command publishes itself into: 'palette', 'menu:tab', ... */
  slots?: string[];
  run: CommandHandler;
}

export interface CommandRegistry {
  register(def: CommandDefinition): Disposable;
  unregister(id: string, scopeId?: string): void;
  get(id: string): CommandDefinition | undefined;
  list(options?: { scope?: CommandScope; slot?: string; enabledOnly?: boolean }): CommandDefinition[];
  /** Resolve through the active scope chain, innermost first. */
  resolve(id: string): CommandDefinition | undefined;
  execute(
    id: string,
    args?: Record<string, unknown>,
    source?: CommandContext['source'],
  ): Promise<unknown>;
  /** True when the command exists and its `when` clause passes. */
  enabled(id: string): boolean;
  /** A switch's state, or undefined when the command is not a switch. */
  isChecked(id: string): boolean | undefined;
}
