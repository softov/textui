import type { Disposable } from './disposable.js';

/**
 * Syntax highlighting.
 *
 * A highlighter names *scopes*, never colours. The theme owns the palette, so
 * one JSON highlighter looks right on a dark console, a paper report and a
 * sixteen-colour terminal without knowing that any of them exist - and a
 * colourless terminal simply resolves every scope to the default foreground.
 *
 * The scope list is closed on purpose. An open vocabulary means a theme can
 * only guess what a highlighter will emit, and the guess is what produces the
 * uncoloured token nobody can explain.
 */
export type SyntaxScope =
  | 'plain'
  | 'keyword'
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'
  | 'comment'
  | 'punctuation'
  /** An object key, a column name, a field label - the left of a pair. */
  | 'key'
  | 'operator'
  | 'type'
  | 'function'
  | 'tag'
  | 'attribute'
  | 'regexp'
  | 'escape'
  /** Syntactically wrong. Worth seeing rather than hiding. */
  | 'invalid';

export const SYNTAX_SCOPES: readonly SyntaxScope[] = [
  'plain', 'keyword', 'string', 'number', 'boolean', 'null', 'comment',
  'punctuation', 'key', 'operator', 'type', 'function', 'tag', 'attribute',
  'regexp', 'escape', 'invalid',
];

/** A run of text with one scope. Never spans a newline. */
export interface SyntaxToken {
  text: string;
  scope: SyntaxScope;
}

/** A scored region of the source, before it is split into lines. */
export interface SyntaxSpan {
  start: number;
  end: number;
  scope: SyntaxScope;
}

export interface HighlighterDefinition {
  id: string;
  title?: string;
  /** Resource kinds this claims: `file.data.json`, `log.stream`. */
  kinds?: string[];
  /** Filename globs, for when nothing has classified the resource yet. */
  extensions?: string[];
  /** Higher wins when several match. */
  priority?: number;
  /**
   * Tokenise a whole document into one array per line.
   *
   * The result must have exactly as many entries as `text.split('\n')`, and
   * the tokens on each line must join back to that line. The registry checks
   * both and falls back to plain text rather than paint a file that no longer
   * lines up with its own gutter.
   */
  tokenize(text: string): SyntaxToken[][];
}

export interface SyntaxQuery {
  /** Resource kind, when the resource has been classified. */
  kind?: string;
  /** URI or filename, matched against `extensions`. */
  uri?: string;
  /** An explicit highlighter id, which wins over everything. */
  language?: string;
}

export interface SyntaxRegistry {
  register(def: HighlighterDefinition): Disposable;
  unregister(id: string): void;
  get(id: string): HighlighterDefinition | undefined;
  list(): HighlighterDefinition[];
  /** The best highlighter for this resource, or undefined. */
  find(query: SyntaxQuery): HighlighterDefinition | undefined;
  /** Tokenise, falling back to one plain token per line. */
  tokenize(text: string, query?: SyntaxQuery): SyntaxToken[][];
}
