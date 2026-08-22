import type { MarkdownLayoutOptions, MarkdownRow, MarkdownRun } from '../types/markdown.js';
import type { StyleColor } from '../types/style.js';
import { graphemes, stringWidth, wrapText } from './text.js';

/**
 * Markdown, laid out.
 *
 * Not a parser - a formatter for the subset that appears in READMEs, notes and
 * anything an agent or a service writes for a person: headings, lists, rules,
 * fences, block quotes, and inline emphasis, code and links.
 *
 * Pure, and measured in cells. It takes the glyphs it needs rather than
 * reading a theme, so it can be called from a test, from a viewer that windows
 * the rows, and from a component that draws all of them.
 */

/**
 * The delimiters, guarded.
 *
 * The guards are the whole difficulty. A single `*` beside a double one is not
 * an opener - `2 * 3 and **half a bold` italicised " 3 and " and ate a
 * character, because the lone asterisk paired with the first half of the
 * unclosed pair. A delimiter with a space just inside it is arithmetic or a
 * footnote, not emphasis. And an underscore needs a word boundary as well, or
 * `snake_case_name` goes italic in the middle.
 */
const PATTERNS = [
  String.raw`\*\*(?!\s)[^*]+(?<!\s)\*\*`,
  String.raw`(?<![\w_])__(?!\s)[^_]+(?<!\s)__(?![\w_])`,
  String.raw`\x60[^\x60]+\x60`,
  String.raw`(?<!\*)\*(?!\s)[^*]+(?<!\s)\*(?!\*)`,
  String.raw`(?<![\w_])_(?!\s)[^_]+(?<!\s)_(?![\w_])`,
  String.raw`\[[^\]]+\]\([^)]+\)`,
];

/** One capturing group, so `split` keeps the delimited pieces. */
const INLINE = new RegExp(`(${PATTERNS.join('|')})`);

/**
 * Emphasis, code and links, as styled runs.
 *
 * Unmatched markers stay literal: a lone asterisk in prose is an asterisk, and
 * a document that reformats itself as the closing one arrives is worse than
 * one that never tried.
 */
export function inlineRuns(text: string): MarkdownRun[] {
  const runs: MarkdownRun[] = [];
  for (const piece of text.split(INLINE)) {
    if (piece === '') continue;
    if (/^\*\*[^*]+\*\*$/.test(piece) || /^__[^_]+__$/.test(piece)) {
      runs.push({ text: piece.slice(2, -2), bold: true });
    } else if (/^`[^`]+`$/.test(piece)) {
      runs.push({ text: piece.slice(1, -1), code: true });
    } else if (/^\*[^*]+\*$/.test(piece) || /^_[^_]+_$/.test(piece)) {
      runs.push({ text: piece.slice(1, -1), italic: true });
    } else {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(piece);
      if (link) runs.push({ text: link[1] ?? '', link: link[2] ?? '' });
      else runs.push({ text: piece });
    }
  }
  return runs.length > 0 ? runs : [{ text: '' }];
}

/**
 * Fold styled runs into lines that fit.
 *
 * `wrapText` wraps a string, and a string cannot carry which half of it was
 * bold - so the wrap happens over runs, on cell widths rather than character
 * counts. A word longer than the whole width is broken rather than allowed to
 * decide the width of the pane it is in.
 */
export function wrapRuns(runs: MarkdownRun[], width: number): MarkdownRun[][] {
  if (width <= 0) return [runs];
  const lines: MarkdownRun[][] = [];
  let line: MarkdownRun[] = [];
  let used = 0;

  const push = (run: MarkdownRun, text: string): void => {
    const last = line[line.length - 1];
    if (last && sameStyle(last, run)) last.text += text;
    else line.push({ ...run, text });
    used += stringWidth(text);
  };

  for (const run of runs) {
    for (const word of run.text.split(/(\s+)/)) {
      if (word === '') continue;
      const w = stringWidth(word);

      if (/^\s+$/.test(word)) {
        // A space at the start of a line is a space nobody typed.
        if (used > 0 && used + w <= width) push(run, word);
        continue;
      }

      if (used + w > width && used > 0) { lines.push(line); line = []; used = 0; }

      if (w > width) {
        let rest = graphemes(word);
        while (rest.length > 0) {
          const room = Math.max(1, width - used);
          push(run, rest.slice(0, room).join(''));
          rest = rest.slice(room);
          if (rest.length > 0) { lines.push(line); line = []; used = 0; }
        }
        continue;
      }

      push(run, word);
    }
  }

  if (line.length > 0) lines.push(line);
  return lines.length > 0 ? lines : [[{ text: '' }]];
}

function sameStyle(a: MarkdownRun, b: MarkdownRun): boolean {
  return !!a.bold === !!b.bold && !!a.italic === !!b.italic
    && !!a.code === !!b.code && a.link === b.link;
}

/** Wrapped rows behind a gutter: the marker on the first, its width on the rest. */
function withPrefix(
  runs: MarkdownRun[],
  width: number,
  prefix: string,
  options: { continued?: string; prefixFg?: StyleColor } = {},
): MarkdownRow[] {
  const gutter = stringWidth(prefix);
  const rest = options.continued ?? ' '.repeat(gutter);
  return wrapRuns(runs, width <= 0 ? 0 : Math.max(1, width - gutter - 1)).map((line, index) => ({
    kind: 'text' as const,
    runs: line,
    prefix: index === 0 ? prefix : rest,
    ...(options.prefixFg ? { prefixFg: options.prefixFg } : {}),
  }));
}

export function layoutMarkdown(
  source: string | string[],
  options: MarkdownLayoutOptions,
): MarkdownRow[] {
  const { width, bullet = '-', quoteBar = '|', ruled = true } = options;
  const lines = Array.isArray(source) ? source : source.replace(/\r\n/g, '\n').split('\n');
  const rows: MarkdownRow[] = [];
  let fence = 0;
  let inFence = false;
  let language = '';

  for (const line of lines) {
    const marker = /^\s*```(\S*)\s*$/.exec(line);
    if (marker) {
      // An open fence is laid out as a fence from the moment it opens. A turn
      // is streamed, so the closing marker may simply not have been said yet -
      // and a block that flickers between prose and code as the words land is
      // worse than one shown open.
      if (!inFence) language = marker[1] ?? '';
      if (ruled) rows.push({ kind: 'fence', fence, part: inFence ? 'close' : 'open', ...(language ? { language } : {}) });
      if (inFence) fence++;
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      rows.push({ kind: 'fence', fence, part: 'code', text: line, ...(language ? { language } : {}) });
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = (heading[1] as string).length;
      for (const runs of wrapRuns(inlineRuns(heading[2] ?? ''), width)) {
        rows.push({ kind: 'heading', runs, level });
      }
      continue;
    }

    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) { rows.push({ kind: 'rule' }); continue; }

    const item = /^(\s*)[-*+]\s+(.*)$/.exec(line);
    if (item) {
      rows.push(...withPrefix(inlineRuns(item[2] ?? ''), width, `${item[1]}${bullet}`));
      continue;
    }

    const ordered = /^(\s*)(\d+)[.)]\s+(.*)$/.exec(line);
    if (ordered) {
      rows.push(...withPrefix(inlineRuns(ordered[3] ?? ''), width, `${ordered[1]}${ordered[2]}.`));
      continue;
    }

    const quote = /^\s*>\s?(.*)$/.exec(line);
    if (quote) {
      // The bar repeats down every row of the quote: a rule that stopped after
      // the first wrapped row would read as one quoted line and some prose.
      rows.push(...withPrefix(inlineRuns(quote[1] ?? ''), width, quoteBar, {
        continued: quoteBar,
        prefixFg: 'borderSubtle',
      }));
      continue;
    }

    if (line.trim() === '') { rows.push({ kind: 'text', runs: [{ text: '' }] }); continue; }

    for (const runs of wrapRuns(inlineRuns(line), width)) rows.push({ kind: 'text', runs });
  }

  // An unterminated fence still gets its closing rule, so the box reads as a
  // box rather than as something the renderer forgot to finish.
  if (inFence && ruled) rows.push({ kind: 'fence', fence, part: 'close' });

  return rows;
}

/** Every run's text, for a measurement or a test that does not care how it looks. */
export function runsToText(runs: MarkdownRun[]): string {
  return runs.map((run) => run.text).join('');
}

/** Wrap plain text the way a row does, for callers that have no runs. */
export function wrapAt(text: string, width: number): string[] {
  if (width <= 0) return [text];
  const wrapped = wrapText(text, width);
  return wrapped.length > 0 ? wrapped : [''];
}
