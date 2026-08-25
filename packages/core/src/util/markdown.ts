import type {
  MarkdownAlign, MarkdownLayoutOptions, MarkdownRow, MarkdownRun,
} from '../types/markdown.js';
import type { TableRules } from '../types/style.js';
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
  const { width, bullet = '-', quoteBar = '|', ruled = true, tableRules = 'header' } = options;
  const lines = Array.isArray(source) ? source : source.replace(/\r\n/g, '\n').split('\n');
  const rows: MarkdownRow[] = [];
  let fence = 0;
  let inFence = false;
  let language = '';
  let table = 0;

  // By index rather than by value: a table is only a table because of the line
  // *after* its header, so this loop has to be able to look at it.
  for (let at = 0; at < lines.length; at++) {
    const line = lines[at] as string;
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

    // Before headings and lists, because a cell may contain either and the
    // pipes are what decide. After fences, because inside one nothing is.
    if (line.includes('|') && DIVIDER.test(lines[at + 1] ?? '')) {
      const align = cellsOf(lines[at + 1] as string).map(alignOf);
      const body: string[][] = [];
      let end = at + 2;
      while (end < lines.length) {
        const next = lines[end] as string;
        if (!next.includes('|') || next.trim() === '') break;
        body.push(cellsOf(next));
        end++;
      }
      rows.push(...tableRows(cellsOf(line), body, align, width, table, tableRules));
      table++;
      at = end - 1;
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

/**
 * The `|---|:--:|---:|` line, which is what makes the line above it a header.
 *
 * A row of pipes on its own is a row of pipes - `a | b` is arithmetic or a
 * shell pipeline far more often than it is a one-column table, and treating
 * every line with a bar in it as a table is how prose ends up in a grid.
 */
const DIVIDER = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

/**
 * One line into its cells.
 *
 * The outer pipes are optional in every dialect anybody writes, so they are
 * stripped rather than required. `\|` is an escaped bar inside a cell and not
 * a boundary - which is the only way to put a bar in a table at all.
 */
function cellsOf(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed
    .split(/(?<!\\)\|/)
    .map((cell) => cell.replace(/\\\|/g, '|').trim());
}

function alignOf(spec: string): MarkdownAlign {
  const left = spec.startsWith(':');
  const right = spec.endsWith(':');
  if (left && right) return 'center';
  return right ? 'right' : 'left';
}

/**
 * Cut and pad one cell to exactly `width`, keeping the styles.
 *
 * Cut, never wrapped: a table row has to stay one row tall or the document's
 * length stops being a count of rows, and every viewer that windows this
 * scrolls to the wrong place.
 */
function fitRuns(runs: MarkdownRun[], width: number, align: MarkdownAlign): MarkdownRun[] {
  const out: MarkdownRun[] = [];
  let used = 0;
  for (const run of runs) {
    if (used >= width) break;
    const room = width - used;
    if (stringWidth(run.text) <= room) {
      out.push(run);
      used += stringWidth(run.text);
      continue;
    }
    // The ellipsis costs a cell, so it is only worth it when there is a cell
    // to spend: at a width of one, a bare glyph says less than the letter.
    const keep = room > 1 ? room - 1 : room;
    const cut: string[] = [];
    let taken = 0;
    for (const g of graphemes(run.text)) {
      const w = stringWidth(g);
      if (taken + w > keep) break;
      cut.push(g);
      taken += w;
    }
    out.push({ ...run, text: room > 1 ? `${cut.join('')}\u2026` : cut.join('') });
    used = width;
    break;
  }

  const slack = Math.max(0, width - used);
  if (slack === 0) return out;
  const before = align === 'right' ? slack : align === 'center' ? Math.floor(slack / 2) : 0;
  const after = slack - before;
  return [
    ...(before ? [{ text: ' '.repeat(before) }] : []),
    ...out,
    ...(after ? [{ text: ' '.repeat(after) }] : []),
  ];
}

/**
 * A whole table, measured once.
 *
 * The columns are as wide as their widest cell wants, and when that is more
 * than the space there is they give it back in proportion - the widest loses
 * the most, because it is the one with the most to lose. Three cells is the
 * floor: below that a column is an ellipsis and a space, which is narrower
 * than saying nothing.
 */
function tableRows(
  head: string[],
  body: string[][],
  align: MarkdownAlign[],
  width: number,
  table: number,
  rules: TableRules,
): MarkdownRow[] {
  const columns = Math.max(head.length, align.length, ...body.map((r) => r.length));
  const at = (row: string[], i: number): string => row[i] ?? '';
  const runsFor = (text: string, bold: boolean): MarkdownRun[] =>
    inlineRuns(text).map((run) => (bold ? { ...run, bold: true } : run));

  const natural = Array.from({ length: columns }, (_, i) => Math.max(
    stringWidth(at(head, i)),
    ...body.map((row) => stringWidth(at(row, i))),
    1,
  ));

  // A rule between every pair of columns, and a box around the lot. The box
  // is what makes it read as a table rather than as text that happens to line
  // up - which matters most on a theme that draws no borders anywhere else,
  // because there a table with only its columns ruled has nothing to say it
  // ended.
  const gaps = (columns - 1) * SEPARATOR + OUTER;
  const room = width > 0 ? Math.max(columns * MIN_COLUMN, width - gaps) : Infinity;
  const wanted = natural.reduce((sum, n) => sum + n, 0);
  const widths = wanted <= room
    ? natural
    : share(natural, room);

  const line = (cells: string[], part: 'head' | 'body'): MarkdownRow => ({
    kind: 'table',
    table,
    part,
    widths,
    align,
    cells: widths.map((w, i) => fitRuns(
      runsFor(at(cells, i), part === 'head'),
      w,
      align[i] ?? 'left',
    )),
  });

  const edge = (part: 'top' | 'rule' | 'bottom'): MarkdownRow =>
    ({ kind: 'table', table, part, cells: [], widths, align });

  return [
    edge('top'),
    line(head, 'head'),
    edge('rule'),
    // A rule between every pair, when the theme asked for them. Between, not
    // after: a rule under the last row and then the box's own bottom edge is
    // two lines saying the same thing.
    ...body.flatMap((row, i) => (rules === 'all' && i > 0
      ? [edge('rule'), line(row, 'body')]
      : [line(row, 'body')])),
    edge('bottom'),
  ];
}

/** Cells between two columns: a space, a rule, a space. */
const SEPARATOR = 3;
/** The box: a rule and a space at each end. */
const OUTER = 4;
const MIN_COLUMN = 3;

/**
 * Shrink columns into `room`, proportionally, without losing a cell to
 * rounding.
 *
 * The remainder goes to the widest columns one at a time rather than to the
 * first: handing every leftover cell to column one is what turns a five-column
 * table into one wide column and four ellipses.
 */
function share(natural: number[], room: number): number[] {
  const total = natural.reduce((sum, n) => sum + n, 0);
  const scaled = natural.map((n) => Math.max(MIN_COLUMN, Math.floor((n / total) * room)));
  let spare = room - scaled.reduce((sum, n) => sum + n, 0);
  const order = natural
    .map((n, i) => [n, i] as const)
    .sort((a, b) => b[0] - a[0])
    .map(([, i]) => i);
  for (let i = 0; spare > 0; i = (i + 1) % order.length) {
    scaled[order[i] as number] = (scaled[order[i] as number] as number) + 1;
    spare--;
  }
  return scaled;
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
