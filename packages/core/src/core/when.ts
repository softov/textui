import type { ContextValue, WhenClause, WhenEngine } from '../types/when.js';
import type { BindingPath } from '../types/graph.js';
import type { ReactiveStore } from '../types/store.js';

/**
 * A `when` clause is a small expression over store paths and context keys.
 * Chrome that should not exist for this user does not mount, rather than
 * mounting disabled - which is why this evaluates rather than styles.
 *
 * Supported: `&&` `||` `!` `==` `!=` `>` `>=` `<` `<=` `=~`, parentheses,
 * string/number/boolean literals, `$/store/paths` and bare context keys.
 * Deliberately not a language: no calls, no member access, no assignment.
 */

type Token =
  | { t: 'path'; v: string }
  | { t: 'ident'; v: string }
  | { t: 'string'; v: string }
  | { t: 'number'; v: number }
  | { t: 'op'; v: string };

const OPERATORS = ['&&', '||', '==', '!=', '>=', '<=', '=~', '!', '>', '<', '(', ')'];

function tokenize(input: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i] as string;
    if (/\s/.test(c)) { i++; continue; }

    if (c === '$' && input[i + 1] === '/') {
      let j = i + 2;
      while (j < input.length && /[A-Za-z0-9_\-./*]/.test(input[j] as string)) j++;
      out.push({ t: 'path', v: input.slice(i, j) });
      i = j;
      continue;
    }

    if (c === "'" || c === '"') {
      let j = i + 1;
      let v = '';
      while (j < input.length && input[j] !== c) {
        if (input[j] === '\\') j++;
        v += input[j];
        j++;
      }
      out.push({ t: 'string', v });
      i = j + 1;
      continue;
    }

    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < input.length && /[0-9.]/.test(input[j] as string)) j++;
      out.push({ t: 'number', v: Number(input.slice(i, j)) });
      i = j;
      continue;
    }

    const op = OPERATORS.find((o) => input.startsWith(o, i));
    if (op) {
      out.push({ t: 'op', v: op });
      i += op.length;
      continue;
    }

    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < input.length && /[A-Za-z0-9_.:-]/.test(input[j] as string)) j++;
      out.push({ t: 'ident', v: input.slice(i, j) });
      i = j;
      continue;
    }

    throw new SyntaxError(`unexpected character "${c}" in when clause: ${input}`);
  }
  return out;
}

type Resolver = (name: string, isPath: boolean) => unknown;

function truthy(v: unknown): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return v !== '' && v !== 'false';
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

class Parser {
  private pos = 0;
  constructor(private tokens: Token[], private resolve: Resolver) {}

  parse(): unknown {
    const v = this.or();
    if (this.pos < this.tokens.length) {
      throw new SyntaxError('trailing tokens in when clause');
    }
    return v;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private eat(op: string): boolean {
    const t = this.peek();
    if (t && t.t === 'op' && t.v === op) {
      this.pos++;
      return true;
    }
    return false;
  }

  private or(): unknown {
    let left = this.and();
    while (this.eat('||')) {
      const right = this.and();
      left = truthy(left) || truthy(right);
    }
    return left;
  }

  private and(): unknown {
    let left = this.comparison();
    while (this.eat('&&')) {
      const right = this.comparison();
      left = truthy(left) && truthy(right);
    }
    return left;
  }

  private comparison(): unknown {
    const left = this.unary();
    for (const op of ['==', '!=', '>=', '<=', '>', '<', '=~'] as const) {
      if (this.eat(op)) {
        const right = this.unary();
        switch (op) {
          case '==': return looseEquals(left, right);
          case '!=': return !looseEquals(left, right);
          case '>': return Number(left) > Number(right);
          case '>=': return Number(left) >= Number(right);
          case '<': return Number(left) < Number(right);
          case '<=': return Number(left) <= Number(right);
          case '=~': return new RegExp(String(right)).test(String(left ?? ''));
        }
      }
    }
    return left;
  }

  private unary(): unknown {
    if (this.eat('!')) return !truthy(this.unary());
    return this.primary();
  }

  private primary(): unknown {
    if (this.eat('(')) {
      const v = this.or();
      if (!this.eat(')')) throw new SyntaxError('missing ")" in when clause');
      return v;
    }
    const t = this.peek();
    if (!t) throw new SyntaxError('unexpected end of when clause');
    this.pos++;
    switch (t.t) {
      case 'string': return t.v;
      case 'number': return t.v;
      case 'path': return this.resolve(t.v, true);
      case 'ident':
        if (t.v === 'true') return true;
        if (t.v === 'false') return false;
        if (t.v === 'null') return null;
        return this.resolve(t.v, false);
      default:
        throw new SyntaxError(`unexpected "${t.v}" in when clause`);
    }
  }
}

function looseEquals(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a === 'number' || typeof b === 'number') return Number(a) === Number(b);
  return String(a) === String(b);
}

export class When implements WhenEngine {
  private context = new Map<string, ContextValue>();
  private cache = new Map<string, Token[]>();

  constructor(private store: ReactiveStore) {}

  evaluate(clause: WhenClause | undefined, extra?: Record<string, ContextValue>): boolean {
    if (!clause || clause.trim() === '') return true;
    try {
      let tokens = this.cache.get(clause);
      if (!tokens) {
        tokens = tokenize(clause);
        this.cache.set(clause, tokens);
      }
      const resolve: Resolver = (name, isPath) => {
        if (isPath) return this.store.get(name as BindingPath);
        if (extra && name in extra) return extra[name];
        return this.context.get(name);
      };
      return truthy(new Parser(tokens, resolve).parse());
    } catch (err) {
      // A malformed clause is a programmer error, and hiding chrome silently
      // is worse than showing it - fail loud, render visible.
      console.error(`[textui/when] bad clause "${clause}"`, err);
      return true;
    }
  }

  dependencies(clause: WhenClause): BindingPath[] {
    try {
      return tokenize(clause)
        .filter((t): t is { t: 'path'; v: string } => t.t === 'path')
        .map((t) => t.v as BindingPath);
    } catch {
      return [];
    }
  }

  setContext(key: string, value: ContextValue): void {
    this.context.set(key, value);
  }

  getContext(key: string): ContextValue | undefined {
    return this.context.get(key);
  }
}

export function createWhen(store: ReactiveStore): When {
  return new When(store);
}
