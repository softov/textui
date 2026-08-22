import type {
  HighlighterDefinition, SyntaxQuery, SyntaxRegistry, SyntaxScope, SyntaxSpan,
  SyntaxToken,
} from '../types/syntax.js';
import type { Disposable } from '../types/disposable.js';
import { toDisposable } from '../util/disposable.js';

/**
 * The highlighter registry.
 *
 * Late binding, like every other registry here: a file whose kind has no
 * highlighter is shown uncoloured rather than refused, and registering one
 * later colours every viewer already on screen.
 */

/**
 * The last segment of a URI, without a query or a fragment.
 *
 * Exported because three places wanted it and each had written its own: the
 * highlighter matching a glob, the resource registry naming a resource, and a
 * viewer saying which file it is showing.
 */
export function nameOf(uri: string): string {
  const clean = uri.split(/[?#]/)[0] ?? uri;
  return clean.split('/').pop() ?? clean;
}

function matchesGlob(name: string, pattern: string): boolean {
  if (pattern.startsWith('*.')) {
    return name.toLowerCase().endsWith(pattern.slice(1).toLowerCase());
  }
  return name.toLowerCase() === pattern.toLowerCase();
}

/** One plain token per line: what an unhighlighted document looks like. */
export function plainTokens(text: string): SyntaxToken[][] {
  return text.split('\n').map((line) => (line === '' ? [] : [{ text: line, scope: 'plain' as const }]));
}

/**
 * Split scored spans into per-line tokens.
 *
 * Highlighters are far easier to write as a single scan over the source than
 * as a line-aware state machine, so they score offsets and this does the
 * splitting - including the newlines inside a multi-line string, which is the
 * part a hand-written splitter always gets wrong.
 */
export function tokensFromSpans(text: string, spans: SyntaxSpan[]): SyntaxToken[][] {
  const ordered = [...spans].sort((a, b) => a.start - b.start);
  const lines = text.split('\n');
  const out: SyntaxToken[][] = lines.map(() => []);

  // Line index for every offset, computed once.
  const lineStarts: number[] = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') lineStarts.push(i + 1);
  }
  const lineAt = (offset: number): number => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if ((lineStarts[mid] as number) <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };

  const push = (start: number, end: number, scope: SyntaxScope): void => {
    if (end <= start) return;
    let cursor = start;
    while (cursor < end) {
      const line = lineAt(cursor);
      const lineEnd = (lineStarts[line] as number) + (lines[line] as string).length;
      const stop = Math.min(end, lineEnd);
      if (stop > cursor) {
        (out[line] as SyntaxToken[]).push({ text: text.slice(cursor, stop), scope });
      }
      cursor = stop + 1; // step over the newline
    }
  };

  let cursor = 0;
  for (const span of ordered) {
    // Overlaps are a bug in the highlighter, not a reason to lose text: the
    // first span wins the shared cells and the rest of this one still lands.
    const start = Math.max(cursor, span.start);
    const end = Math.min(Math.max(start, span.end), text.length);
    if (end <= cursor) continue;
    if (start > cursor) push(cursor, start, 'plain');
    push(start, end, span.scope);
    cursor = end;
  }
  if (cursor < text.length) push(cursor, text.length, 'plain');

  return out;
}

/** Build a highlighter from a function that scores spans. */
export function spanHighlighter(
  def: Omit<HighlighterDefinition, 'tokenize'> & { scan(text: string): SyntaxSpan[] },
): HighlighterDefinition {
  const { scan, ...rest } = def;
  return { ...rest, tokenize: (text) => tokensFromSpans(text, scan(text)) };
}

export class Syntax implements SyntaxRegistry {
  private defs = new Map<string, HighlighterDefinition>();

  constructor(
    private deps: {
      /** True when `kind` is `ancestor` or specialises it. */
      kindMatches(kind: string, ancestor: string): boolean;
      onError?(err: unknown, context: string): void;
    } = { kindMatches: (kind, ancestor) => kind === ancestor },
  ) {}

  register(def: HighlighterDefinition): Disposable {
    this.defs.set(def.id, def);
    return toDisposable(() => {
      if (this.defs.get(def.id) === def) this.defs.delete(def.id);
    });
  }

  unregister(id: string): void {
    this.defs.delete(id);
  }

  get(id: string): HighlighterDefinition | undefined {
    return this.defs.get(id);
  }

  list(): HighlighterDefinition[] {
    return [...this.defs.values()];
  }

  find(query: SyntaxQuery): HighlighterDefinition | undefined {
    if (query.language) {
      const named = this.defs.get(query.language);
      if (named) return named;
    }

    const name = query.uri ? nameOf(query.uri) : undefined;
    let best: HighlighterDefinition | undefined;
    let bestScore = -Infinity;

    for (const def of this.defs.values()) {
      let score = def.priority ?? 0;
      let matched = false;

      if (query.kind && def.kinds?.some((k) => this.deps.kindMatches(query.kind as string, k))) {
        // A highlighter registered for the exact kind beats one registered
        // for an ancestor of it.
        matched = true;
        score += def.kinds.includes(query.kind) ? 120 : 100;
      }
      if (name && def.extensions?.some((p) => matchesGlob(name, p))) {
        matched = true;
        score += 60;
      }
      if (matched && score > bestScore) {
        best = def;
        bestScore = score;
      }
    }
    return best;
  }

  tokenize(text: string, query: SyntaxQuery = {}): SyntaxToken[][] {
    const def = this.find(query);
    if (!def) return plainTokens(text);

    const lines = text.split('\n');
    let result: SyntaxToken[][];
    try {
      result = def.tokenize(text);
    } catch (err) {
      this.deps.onError?.(err, `highlighter "${def.id}"`);
      return plainTokens(text);
    }

    // A highlighter that loses or invents a line would slide the whole file
    // against its gutter. Uncoloured is wrong; misaligned is unreadable.
    if (result.length !== lines.length) {
      this.deps.onError?.(
        new Error(
          `[textui] highlighter "${def.id}" returned ${result.length} lines for ` +
          `a ${lines.length}-line document`,
        ),
        'syntax',
      );
      return plainTokens(text);
    }
    return result;
  }
}

export function createSyntax(deps?: ConstructorParameters<typeof Syntax>[0]): Syntax {
  return new Syntax(deps);
}
