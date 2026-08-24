import type { BoxProps, MarkdownRow, MarkdownRun, ResolvedTheme, StyleColor } from '@textui/core';
import {
  defineComponent,
  h,
  layoutMarkdown,
  repeatToWidth,
  useMeasure,
  useMemo,
  useTheme,
} from '@textui/core';
import { CodeViewer } from './code-viewer.js';

// ------------------------------------------------------------------ markdown

export interface MarkdownViewProps extends BoxProps {
  /** The document. Ignored when `rows` is passed. */
  content?: string;
  /** Already laid out - for a viewer that windows the rows itself. */
  rows?: MarkdownRow[];
  /** Paint only this slice. The caller owns the scrolling when it passes one. */
  window?: { first: number; count: number };
  /** Collapse past this many rows, with a count of what is hidden. */
  maxLines?: number;
  /** Dim everything, for reasoning and other second-voice text. */
  quiet?: boolean;
}

/**
 * Markdown, drawn into the width it was given.
 *
 * It fills the space it is in and does not scroll: a document viewer owns its
 * viewport and a message in a transcript does not, so scrolling belongs to
 * whoever holds the rows, not to the thing that paints them. Pass `content`
 * and it lays out what it measured; pass `rows` and a `window` and it paints
 * that slice of somebody else's layout.
 *
 * Inline emphasis, code and links survive, because they are meaning rather
 * than markup wherever the text was written by an agent or a service for a
 * person to read.
 */
export const MarkdownView = defineComponent<MarkdownViewProps>('MarkdownView', (props) => {
  const { content = '', rows: given, window: slice, maxLines, quiet, ...rest } = props;
  const theme = useTheme();
  const measured = useMeasure();
  const width = measured.width > 0 ? measured.width : 0;
  const ruled = theme.border !== 'none';

  const laid = useMemo(
    () => given ?? layoutMarkdown(content, {
      width,
      bullet: theme.glyphs.bulletFilled,
      quoteBar: theme.borderChars().left,
      ruled,
    }),
    [given, content, width, theme, ruled],
  );

  const first = slice?.first ?? 0;
  const shown = slice ? laid.slice(first, first + slice.count) : laid;
  const capped = maxLines !== undefined ? shown.slice(0, maxLines) : shown;
  const hidden = shown.length - capped.length;

  const out: unknown[] = [];
  for (let i = 0; i < capped.length;) {
    const row = capped[i] as MarkdownRow;
    const key = first + i;

    if (row.kind === 'fence') {
      // A fence the window cuts through is still one box, with only the rules
      // that are actually on screen.
      let end = i;
      while (end < capped.length) {
        const next = capped[end] as MarkdownRow;
        if (next.kind !== 'fence' || next.fence !== row.fence) break;
        end++;
      }
      const group = capped.slice(i, end) as Extract<MarkdownRow, { kind: 'fence' }>[];
      const code = group.filter((r) => r.part === 'code').map((r) => r.text ?? '');
      const language = group.find((r) => r.language)?.language;

      if (!ruled) {
        out.push(h('box', { key, padding: [0, 1], bg: 'surfaceAlt' }, h(CodeViewer, {
          content: code.join('\n'),
          lineNumbers: false, scrollbar: false, showCaret: false, disabled: true,
          ...(language ? { language } : {}),
        })));
      } else if (code.length === 0) {
        // Only one edge of the box is on screen, and a box one row tall cannot
        // say which. Drawn directly, so the seam is invisible as it scrolls.
        out.push(h('text', {
          key,
          content: fenceEdge(theme, width, group.some((r) => r.part === 'open')),
          fg: 'borderSubtle',
          wrap: 'none',
        }));
      } else {
        out.push(h('box', {
          key,
          border: {
            style: theme.border,
            color: 'borderSubtle',
            sides: {
              top: group.some((r) => r.part === 'open'),
              bottom: group.some((r) => r.part === 'close'),
              left: true,
              right: true,
            },
          },
          padding: [0, 1],
        }, h(CodeViewer, {
          content: code.join('\n'),
          lineNumbers: false, scrollbar: false, showCaret: false,
          // A fence inside a rendered document is typography, not a control.
          // Focusable, every code block in a README becomes a tab stop.
          disabled: true,
          ...(language ? { language } : {}),
        })));
      }
      i = end;
      continue;
    }

    if (row.kind === 'rule') {
      out.push(h('box', { key, height: 1, fill: theme.borderChars().top, fg: 'borderSubtle' }));
      i++;
      continue;
    }

    if (row.kind === 'heading') {
      out.push(h('box', { key, direction: 'row', overflow: 'hidden' },
        ...runNodes(row.runs, {
          bold: row.level <= 2,
          underline: row.level === 1,
          fg: quiet ? 'muted' : row.level <= 2 ? 'text' : 'muted',
        })));
      i++;
      continue;
    }

    const style = { ...(quiet ? { fg: 'muted' as StyleColor } : row.fg ? { fg: row.fg } : {}) };
    if (row.prefix !== undefined) {
      out.push(h('box', { key, direction: 'row', gap: 1, overflow: 'hidden' },
        h('text', { content: row.prefix, fg: quiet ? 'subtle' : row.prefixFg ?? 'accent' }),
        h('box', { direction: 'row', flex: 1, overflow: 'hidden' }, ...runNodes(row.runs, style))));
      i++;
      continue;
    }

    out.push(h('box', { key, direction: 'row', overflow: 'hidden' }, ...runNodes(row.runs, style)));
    i++;
  }

  return h('box', { role: 'document', direction: 'column', ...rest },
    ...out,
    hidden > 0
      ? h('text', { content: `${theme.glyphs.ellipsis} ${hidden} more lines`, fg: 'subtle' })
      : null,
  );
});

/** One `text` per run, so a bold half of a sentence stays bold after wrapping. */
function runNodes(runs: MarkdownRun[], style: Record<string, unknown>): unknown[] {
  return runs.map((run, i) => h('text', {
    key: i,
    content: run.text,
    wrap: 'none',
    ...style,
    ...(run.bold ? { bold: true } : {}),
    ...(run.italic ? { italic: true } : {}),
    ...(run.code ? { fg: 'accent', bg: 'surfaceAlt' } : {}),
    ...(run.link ? { underline: true, fg: 'info', link: run.link } : {}),
  }));
}

/** The top or bottom edge of a fence, for when the window shows only that row. */
function fenceEdge(theme: ResolvedTheme, width: number, top: boolean): string {
  const chars = theme.borderChars();
  const [left, mid, right] = top
    ? [chars.topLeft, chars.top, chars.topRight]
    : [chars.bottomLeft, chars.bottom, chars.bottomRight];
  return `${left}${repeatToWidth(mid, Math.max(0, width - 2))}${right}`;
}
