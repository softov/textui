import { describe, expect, it } from 'vitest';
import {
  createSyntax, plainTokens, spanHighlighter, tokensFromSpans,
} from '../src/core/syntax.js';
import {
  formatJson, jsonHighlighter, minifyJson, scanJson, sortJsonKeys, validateJson,
} from '../src/adapters/json.js';
import type { SyntaxToken } from '../src/types/syntax.js';

/** Every token joined back, per line. The invariant a viewer depends on. */
function rejoin(lines: SyntaxToken[][]): string {
  return lines.map((tokens) => tokens.map((t) => t.text).join('')).join('\n');
}

function scopesOf(tokens: SyntaxToken[], scope: string): string[] {
  return tokens.filter((t) => t.scope === scope).map((t) => t.text);
}

describe('tokensFromSpans', () => {
  it('reproduces the source exactly', () => {
    const text = 'one two\nthree';
    const out = tokensFromSpans(text, [{ start: 4, end: 7, scope: 'keyword' }]);
    expect(rejoin(out)).toBe(text);
    expect(out).toHaveLength(2);
  });

  it('fills the gaps between spans with plain text', () => {
    const out = tokensFromSpans('ab cd', [{ start: 3, end: 5, scope: 'string' }]);
    expect(out[0]).toEqual([
      { text: 'ab ', scope: 'plain' },
      { text: 'cd', scope: 'string' },
    ]);
  });

  it('splits a span that crosses a newline', () => {
    const text = '"a\nb"';
    const out = tokensFromSpans(text, [{ start: 0, end: 5, scope: 'string' }]);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual([{ text: '"a', scope: 'string' }]);
    expect(out[1]).toEqual([{ text: 'b"', scope: 'string' }]);
  });

  it('gives an empty line no tokens', () => {
    const out = tokensFromSpans('a\n\nb', []);
    expect(out[1]).toEqual([]);
    expect(rejoin(out)).toBe('a\n\nb');
  });

  it('keeps the first of two overlapping spans and loses no text', () => {
    const text = 'abcdef';
    const out = tokensFromSpans(text, [
      { start: 0, end: 4, scope: 'string' },
      { start: 2, end: 6, scope: 'number' },
    ]);
    expect(rejoin(out)).toBe(text);
    expect(out[0]).toEqual([
      { text: 'abcd', scope: 'string' },
      { text: 'ef', scope: 'number' },
    ]);
  });
});

describe('the highlighter registry', () => {
  const json = spanHighlighter({
    id: 'json', kinds: ['file.data.json'], extensions: ['*.json'], scan: scanJson,
  });
  const text = spanHighlighter({ id: 'text', kinds: ['file.text'], scan: () => [] });

  function registry() {
    const syntax = createSyntax({
      kindMatches: (kind, ancestor) => kind === ancestor || kind.startsWith(`${ancestor}.`),
    });
    syntax.register(json);
    syntax.register(text);
    return syntax;
  }

  it('finds a highlighter by kind', () => {
    expect(registry().find({ kind: 'file.data.json' })?.id).toBe('json');
  });

  it('finds one by filename when nothing has classified the resource', () => {
    expect(registry().find({ uri: 'file:///x/package.json' })?.id).toBe('json');
  });

  it('prefers the exact kind over an ancestor', () => {
    expect(registry().find({ kind: 'file.text.something' })?.id).toBe('text');
    expect(registry().find({ kind: 'file.data.json' })?.id).toBe('json');
  });

  it('answers with plain tokens when nothing matches', () => {
    const out = registry().tokenize('hello\nthere', { kind: 'image.png' });
    expect(out).toEqual(plainTokens('hello\nthere'));
  });

  it('falls back to plain text when a highlighter loses a line', () => {
    const errors: string[] = [];
    const syntax = createSyntax({
      kindMatches: (a, b) => a === b,
      onError: (err) => errors.push(String(err)),
    });
    syntax.register({
      id: 'bad',
      kinds: ['thing'],
      tokenize: () => [[{ text: 'only one line', scope: 'plain' }]],
    });

    const out = syntax.tokenize('a\nb\nc', { kind: 'thing' });
    expect(out).toHaveLength(3);
    expect(rejoin(out)).toBe('a\nb\nc');
    expect(errors[0]).toContain('returned 1 lines');
  });

  it('falls back to plain text when a highlighter throws', () => {
    const syntax = createSyntax({ kindMatches: (a, b) => a === b });
    syntax.register({
      id: 'boom',
      kinds: ['thing'],
      tokenize: () => { throw new Error('nope'); },
    });
    expect(rejoin(syntax.tokenize('x', { kind: 'thing' }))).toBe('x');
  });

  it('stops using a highlighter once it is disposed', () => {
    const syntax = createSyntax({ kindMatches: (a, b) => a === b });
    const registration = syntax.register(json);
    expect(syntax.find({ kind: 'file.data.json' })).toBeDefined();
    registration.dispose();
    expect(syntax.find({ kind: 'file.data.json' })).toBeUndefined();
  });
});

describe('the JSON highlighter', () => {
  it('tells a key from a string', () => {
    const [line] = jsonHighlighter.tokenize('{"name": "value"}') as SyntaxToken[][];
    expect(scopesOf(line as SyntaxToken[], 'key')).toEqual(['"name"']);
    expect(scopesOf(line as SyntaxToken[], 'string')).toEqual(['"value"']);
  });

  it('does not call an array element a key', () => {
    const [line] = jsonHighlighter.tokenize('["a", "b"]') as SyntaxToken[][];
    expect(scopesOf(line as SyntaxToken[], 'key')).toEqual([]);
    expect(scopesOf(line as SyntaxToken[], 'string')).toEqual(['"a"', '"b"']);
  });

  it('scores numbers, booleans and null', () => {
    const [line] = jsonHighlighter.tokenize('[1, -2.5e3, true, false, null]') as SyntaxToken[][];
    const tokens = line as SyntaxToken[];
    expect(scopesOf(tokens, 'number')).toEqual(['1', '-2.5e3']);
    expect(scopesOf(tokens, 'boolean')).toEqual(['true', 'false']);
    expect(scopesOf(tokens, 'null')).toEqual(['null']);
  });

  it('colours an escape apart from the string around it', () => {
    const [line] = jsonHighlighter.tokenize('{"a": "x\\ny"}') as SyntaxToken[][];
    expect(scopesOf(line as SyntaxToken[], 'escape')).toEqual(['\\n']);
  });

  it('marks what does not belong rather than hiding it', () => {
    const [line] = jsonHighlighter.tokenize('{"a": oops}') as SyntaxToken[][];
    expect(scopesOf(line as SyntaxToken[], 'invalid')).toEqual(['oops']);
  });

  it('keeps every character of a multi-line document', () => {
    const text = '{\n  "a": [1, 2],\n  "b": {"c": null}\n}';
    expect(rejoin(jsonHighlighter.tokenize(text))).toBe(text);
  });

  it('colours a file that is mid-edit and invalid', () => {
    const text = '{\n  "a": \n}';
    expect(rejoin(jsonHighlighter.tokenize(text))).toBe(text);
  });
});

describe('the JSON transforms', () => {
  it('formats with the given indent', () => {
    expect(formatJson('{"a":1}', { indent: 2 })).toBe('{\n  "a": 1\n}');
    expect(formatJson('{"a":1}', { indent: 4 })).toBe('{\n    "a": 1\n}');
  });

  it('minifies', () => {
    expect(minifyJson('{\n  "a": 1\n}')).toBe('{"a":1}');
  });

  it('sorts keys at every level and leaves arrays alone', () => {
    const out = sortJsonKeys('{"b":1,"a":{"d":2,"c":[3,1,2]}}', { indent: 0 });
    expect(JSON.parse(out)).toEqual({ a: { c: [3, 1, 2], d: 2 }, b: 1 });
    expect(out.indexOf('"a"')).toBeLessThan(out.indexOf('"b"'));
  });

  it('reports where a document stops being valid', () => {
    const problem = validateJson('{\n  "a": 1,\n  oops\n}');
    expect(problem).not.toBeNull();
    expect(problem?.line).toBe(3);
  });

  it('says nothing about a valid document', () => {
    expect(validateJson('{"a": [1, 2, 3]}')).toBeNull();
  });
});
