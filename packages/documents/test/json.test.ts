import { describe, expect, it } from 'vitest';
import {
  formatJson, jsonHighlighter, minifyJson, sortJsonKeys, validateJson,
} from '../src/index.js';
import type { SyntaxToken } from '@textui/core';

function scopesOf(tokens: SyntaxToken[], scope: string): string[] {
  return tokens.filter((t) => t.scope === scope).map((t) => t.text);
}

/** Every token joined back, per line. The invariant a viewer depends on. */
function rejoin(lines: SyntaxToken[][]): string {
  return lines.map((tokens) => tokens.map((t) => t.text).join('')).join('\n');
}

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
