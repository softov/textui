import type {
  CommandContext, CommandDefinition, CommandRegistry, CommandScope,
} from '../types/command.js';
import type { Disposable } from '../types/disposable.js';
import type { ReactiveStore } from '../types/store.js';
import type { WhenEngine } from '../types/when.js';
import type { TextUIApp } from '../types/app.js';
import { toDisposable } from '../util/disposable.js';

const SCOPE_ORDER: CommandScope[] = ['component', 'region', 'screen', 'app'];

/**
 * Commands are the only way an action should be spelled.
 *
 * A button that calls an API directly and a palette entry that calls the same
 * API are two implementations that will drift; a button that runs a registered
 * command cannot drift from the command. That is also why resolution walks
 * from the most specific scope outward - `table.search` means whichever table
 * is focused, without every table inventing its own id.
 */
export class Commands implements CommandRegistry {
  private byId = new Map<string, CommandDefinition[]>();
  /** Scope instance ids that are currently active, innermost first. */
  private activeScopes: string[] = [];

  constructor(
    private deps: {
      store: ReactiveStore;
      when: WhenEngine;
      app(): TextUIApp | null;
      onError(err: unknown, context: string): void;
    },
  ) {}

  setActiveScopes(ids: string[]): void {
    this.activeScopes = ids;
  }

  register(def: CommandDefinition): Disposable {
    const list = this.byId.get(def.id) ?? [];
    list.push(def);
    this.byId.set(def.id, list);

    return toDisposable(() => {
      const current = this.byId.get(def.id);
      if (!current) return;
      const next = current.filter((d) => d !== def);
      if (next.length === 0) this.byId.delete(def.id);
      else this.byId.set(def.id, next);
    });
  }

  unregister(id: string, scopeId?: string): void {
    if (scopeId === undefined) {
      this.byId.delete(id);
      return;
    }
    const next = (this.byId.get(id) ?? []).filter((d) => d.scopeId !== scopeId);
    if (next.length === 0) this.byId.delete(id);
    else this.byId.set(id, next);
  }

  get(id: string): CommandDefinition | undefined {
    return this.resolve(id);
  }

  list(options: { scope?: CommandScope; slot?: string; enabledOnly?: boolean } = {}): CommandDefinition[] {
    const out: CommandDefinition[] = [];
    for (const defs of this.byId.values()) {
      for (const def of defs) {
        if (options.scope && (def.scope ?? 'app') !== options.scope) continue;
        if (options.slot && !(def.slots ?? []).includes(options.slot)) continue;
        if (options.enabledOnly && !this.deps.when.evaluate(def.when)) continue;
        out.push(def);
      }
    }
    return out;
  }

  /** Innermost active scope wins; an app-scoped registration is the floor. */
  resolve(id: string): CommandDefinition | undefined {
    const candidates = (this.byId.get(id) ?? []).filter((def) =>
      this.deps.when.evaluate(def.when),
    );
    if (candidates.length === 0) return undefined;
    if (candidates.length === 1) return candidates[0];

    for (const scopeId of this.activeScopes) {
      const match = candidates.find((d) => d.scopeId === scopeId);
      if (match) return match;
    }
    for (const scope of SCOPE_ORDER) {
      const match = candidates.find((d) => (d.scope ?? 'app') === scope && !d.scopeId);
      if (match) return match;
    }
    return candidates[candidates.length - 1];
  }

  enabled(id: string): boolean {
    return this.resolve(id) !== undefined;
  }

  async execute(
    id: string,
    args: Record<string, unknown> = {},
    source: CommandContext['source'] = 'api',
  ): Promise<unknown> {
    const def = this.resolve(id);
    if (!def) {
      // Not throwing would let a typo in a keybinding vanish silently.
      throw new Error(`[textui] no command registered as "${id}"`);
    }

    const missing = (def.args ?? [])
      .filter((a) => a.required && args[a.name] === undefined && a.default === undefined)
      .map((a) => a.name);
    if (missing.length > 0) {
      throw new Error(`[textui] command "${id}" needs: ${missing.join(', ')}`);
    }

    const filled: Record<string, unknown> = { ...args };
    for (const spec of def.args ?? []) {
      if (filled[spec.name] === undefined && spec.default !== undefined) {
        filled[spec.name] = spec.default;
      }
    }

    const app = this.deps.app();
    const ctx: CommandContext = {
      app: app as TextUIApp,
      store: this.deps.store,
      scopeId: def.scopeId ?? null,
      source,
    };

    // Announced, not just run. Which command fired and what asked for it is
    // the first question anyone debugging a keybinding, a menu or a palette
    // has, and reconstructing it from its effects is guesswork.
    app?.events.emit('@/command/run', { id, source, args: filled });

    try {
      const result = await def.run(filled, ctx);
      app?.events.emit('@/command/done', { id, source });
      return result;
    } catch (err) {
      app?.events.emit('@/command/error', { id, source, message: String(err) });
      this.deps.onError(err, `command "${id}"`);
      throw err;
    }
  }
}

export function createCommands(deps: ConstructorParameters<typeof Commands>[0]): Commands {
  return new Commands(deps);
}
