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

export interface ArgSpec {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'unknown';
  required?: boolean;
  description?: string;
  /** Fixed choices, or a resolver for a picker. */
  choices?: string[] | (() => Promise<string[]> | string[]);
  default?: unknown;
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
  keywords?: string[];
  scope?: CommandScope;
  /** The instance this registration belongs to, for non-app scopes. */
  scopeId?: string;
  when?: WhenClause;
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
}
