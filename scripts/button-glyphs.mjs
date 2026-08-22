#!/usr/bin/env node
/**
 * Button glyph sampler.
 *
 * Standalone - no TextUI, no dependencies. It prints the same button drawn
 * every way we could reasonably draw it, so the choice is made by looking
 * rather than by arguing.
 *
 *   node scripts/button-glyphs.mjs
 *   node scripts/button-glyphs.mjs 7        # just sample 7
 *
 * The thing to look for: where a bordered box is filled only on the inside,
 * the border glyph's own cell keeps the backdrop, so a one-cell gap runs
 * between the frame and the fill. Block-element glyphs colour a half or a
 * quarter of their cell, which is how a button closes that gap.
 */

const ESC = '\x1b';
const RESET = `${ESC}[0m`;
const BOLD = `${ESC}[1m`;
const DIM = `${ESC}[2m`;

const fg = ([r, g, b]) => `${ESC}[38;2;${r};${g};${b}m`;
const bg = ([r, g, b]) => `${ESC}[48;2;${r};${g};${b}m`;

/** One run of text in one style. Reset after each, so runs never bleed. */
function S(text, o = {}) {
  let p = '';
  if (o.fg) p += fg(o.fg);
  if (o.bg) p += bg(o.bg);
  if (o.bold) p += BOLD;
  if (o.dim) p += DIM;
  return p ? p + text + RESET : text;
}

// --- palette -----------------------------------------------------------
// Roughly the playground's dark theme. `on` is what sits on top of `c`.

const TONES = {
  primary: { c: [91, 124, 250], on: [255, 255, 255] },
  success: { c: [62, 207, 106], on: [6, 26, 13] },
  danger: { c: [242, 84, 91], on: [28, 8, 10] },
};
const MUTED = [122, 122, 140];
const SHADOW = [58, 58, 70];

// --- glyphs ------------------------------------------------------------

const G = {
  full: '█',        // █  FULL BLOCK
  upper: '▀',       // ▀  UPPER HALF
  lower: '▄',       // ▄  LOWER HALF
  left: '▌',        // ▌  LEFT HALF
  right: '▐',       // ▐  RIGHT HALF
  qLowerLeft: '▖',  // ▖
  qLowerRight: '▗', // ▗
  qUpperLeft: '▘',  // ▘
  qUpperRight: '▝', // ▝
  shadeLight: '░',  // ░
  shadeMed: '▒',    // ▒
};

const BOXES = {
  light: '┌─┐│└─┘',   // ┌─┐│└─┘
  rounded: '╭─╮│╰─╯', // ╭─╮│╰─╯
  heavy: '┏━┓┃┗━┛',   // ┏━┓┃┗━┛
  double: '╔═╗║╚═╝',  // ╔═╗║╚═╝
  ascii: '+-+|+-+',
};

/** Split a 7-char box spec into named corners and edges. */
function box(spec) {
  const [tl, top, tr, side, bl, bottom, br] = [...spec];
  return { tl, top, tr, side, bl, bottom, br };
}

// --- composition -------------------------------------------------------

const btn = (lines, width) => ({ lines, width });
const rep = (ch, n) => ch.repeat(Math.max(0, n));

/** Lay buttons out left to right, top-aligned, padding the short ones. */
function row(buttons, gap = 3) {
  const height = Math.max(...buttons.map((b) => b.lines.length));
  const out = [];
  for (let i = 0; i < height; i++) {
    out.push(
      buttons.map((b) => b.lines[i] ?? rep(' ', b.width)).join(rep(' ', gap)),
    );
  }
  return out;
}

// --- the samples -------------------------------------------------------
//
// Each takes the label and a state: `rest` for an unselected button, and a
// tone name for a selected one. Returning the width as well as the lines
// keeps the row compositor from having to measure escape codes.

const SAMPLES = [];
const sample = (title, note, render) => SAMPLES.push({ title, note, render });

sample('bare text', 'no frame, no fill - the tone carries everything', (label, st) => {
  const w = label.length;
  if (st === 'rest') return btn([S(label, { fg: MUTED })], w);
  return btn([S(label, { fg: TONES[st].c, bold: true })], w);
});

sample('bare text, filled', 'a background with no padding clamps the glyphs', (label, st) => {
  const w = label.length;
  if (st === 'rest') return btn([S(label, { fg: MUTED })], w);
  const t = TONES[st];
  return btn([S(label, { fg: t.on, bg: t.c, bold: true })], w);
});

sample('padded fill', 'one space either side, squared off', (label, st) => {
  const w = label.length + 2;
  if (st === 'rest') return btn([S(` ${label} `, { fg: MUTED })], w);
  const t = TONES[st];
  return btn([S(` ${label} `, { fg: t.on, bg: t.c, bold: true })], w);
});

sample('brackets', 'the oldest trick - reads on a terminal with no colour', (label, st) => {
  const w = label.length + 4;
  if (st === 'rest') return btn([S(`[ ${label} ]`, { fg: MUTED })], w);
  const t = TONES[st];
  return btn([S('[', { fg: t.c }) + S(` ${label} `, { fg: t.on, bg: t.c, bold: true }) + S(']', { fg: t.c })], w);
});

sample('half-block caps', `${G.right}fill${G.left} - the cap colours the half that touches the fill`, (label, st) => {
  const w = label.length + 4;
  if (st === 'rest') {
    return btn([S(G.right, { fg: MUTED }) + S(` ${label} `, { fg: MUTED }) + S(G.left, { fg: MUTED })], w);
  }
  const t = TONES[st];
  return btn([
    S(G.right, { fg: t.c }) + S(` ${label} `, { fg: t.on, bg: t.c, bold: true }) + S(G.left, { fg: t.c }),
  ], w);
});

sample('full-block caps', `${G.full} caps - squarer, and a full cell wider each side`, (label, st) => {
  const w = label.length + 4;
  if (st === 'rest') return btn([S(`${G.full} ${label} ${G.full}`, { fg: MUTED })], w);
  const t = TONES[st];
  return btn([
    S(G.full, { fg: t.c }) + S(` ${label} `, { fg: t.on, bg: t.c, bold: true }) + S(G.full, { fg: t.c }),
  ], w);
});

sample('quadrant caps', `${G.qLowerRight}fill${G.qLowerLeft} - a cap that fills only a corner of its cell`, (label, st) => {
  const w = label.length + 4;
  if (st === 'rest') {
    return btn([
      S(G.qLowerRight, { fg: MUTED }) + S(` ${label} `, { fg: MUTED }) + S(G.qLowerLeft, { fg: MUTED }),
    ], w);
  }
  const t = TONES[st];
  return btn([
    S(G.qLowerRight, { fg: t.c }) + S(` ${label} `, { fg: t.on, bg: t.c, bold: true }) + S(G.qLowerLeft, { fg: t.c }),
  ], w);
});

sample('half-block slab', `${G.lower} over ${G.upper} - three rows, but the edges are half-height`, (label, st) => {
  const w = label.length + 4;
  const colour = st === 'rest' ? MUTED : TONES[st].c;
  const inner = st === 'rest'
    ? S(`  ${label}  `, { fg: MUTED })
    : S(`  ${label}  `, { fg: TONES[st].on, bg: TONES[st].c, bold: true });
  return btn([
    S(rep(G.lower, w), { fg: colour }),
    inner,
    S(rep(G.upper, w), { fg: colour }),
  ], w);
});

sample(
  'the pair: outline at rest, slab when filled',
  'same 3 rows, same width, label on the same column - focus shifts nothing',
  (label, st) => {
    const w = label.length + 4;
    if (st === 'rest') {
      // Two of these columns are border and padding.
      const b = box(BOXES.light);
      return btn([
        S(b.tl + rep(b.top, w - 2) + b.tr, { fg: MUTED }),
        S(b.side, { fg: MUTED }) + S(` ${label} `, { fg: MUTED }) + S(b.side, { fg: MUTED }),
        S(b.bl + rep(b.bottom, w - 2) + b.br, { fg: MUTED }),
      ], w);
    }
    // ...and here both are padding, which is why the label does not move.
    const t = TONES[st];
    return btn([
      S(rep(G.lower, w), { fg: t.c }),
      S(`  ${label}  `, { fg: t.on, bg: t.c, bold: true }),
      S(rep(G.upper, w), { fg: t.c }),
    ], w);
  },
);

sample(
  'the pair, as TextUI now draws it',
  `the theme's \`half\` border - every glyph colours the half facing inward`,
  (label, st) => {
    const w = label.length + 4;
    if (st === 'rest') {
      const b = box(BOXES.light);
      return btn([
        S(b.tl + rep(b.top, w - 2) + b.tr, { fg: MUTED }),
        S(b.side, { fg: MUTED }) + S(` ${label} `, { fg: MUTED }) + S(b.side, { fg: MUTED }),
        S(b.bl + rep(b.bottom, w - 2) + b.br, { fg: MUTED }),
      ], w);
    }
    // BORDER_SETS.half, which the theme already ships. Each glyph colours the
    // half of its cell that faces the middle, so the ring meets the inner
    // box's fill with nothing between - and it degrades to ascii for free on
    // a terminal that cannot draw block elements.
    const t = TONES[st];
    return btn([
      S(G.qLowerRight + rep(G.lower, w - 2) + G.qLowerLeft, { fg: t.c }),
      S(G.right, { fg: t.c }) + S(` ${label} `, { fg: t.on, bg: t.c, bold: true }) + S(G.left, { fg: t.c }),
      S(G.qUpperRight + rep(G.upper, w - 2) + G.qUpperLeft, { fg: t.c }),
    ], w);
  },
);

sample('rounded slab', `${G.qLowerRight}${G.lower}${G.qLowerLeft} corners - quadrants pull the edge in`, (label, st) => {
  const w = label.length + 4;
  const colour = st === 'rest' ? MUTED : TONES[st].c;
  const inner = st === 'rest'
    ? S(`  ${label}  `, { fg: MUTED })
    : S(`  ${label}  `, { fg: TONES[st].on, bg: TONES[st].c, bold: true });
  return btn([
    S(G.qLowerRight + rep(G.lower, w - 2) + G.qLowerLeft, { fg: colour }),
    inner,
    S(G.qUpperRight + rep(G.upper, w - 2) + G.qUpperLeft, { fg: colour }),
  ], w);
});

sample('block outline', `${G.lower}/${G.upper} edges, ${G.left}/${G.right} sides - a frame with no gap`, (label, st) => {
  const w = label.length + 4;
  const colour = st === 'rest' ? MUTED : TONES[st].c;
  const t = st === 'rest' ? null : TONES[st];
  const middle = t
    ? S(G.left, { fg: t.c }) + S(` ${label} `, { fg: t.on, bg: t.c, bold: true }) + S(G.right, { fg: t.c })
    : S(G.left, { fg: MUTED }) + S(` ${label} `, { fg: MUTED }) + S(G.right, { fg: MUTED });
  return btn([
    S(rep(G.lower, w), { fg: colour }),
    middle,
    S(rep(G.upper, w), { fg: colour }),
  ], w);
});

sample('solid slab', `${G.full} everywhere - the whole rectangle is the button`, (label, st) => {
  const w = label.length + 4;
  if (st === 'rest') {
    return btn([S(rep(G.full, w), { fg: MUTED }), S(`  ${label}  `, { fg: MUTED }), S(rep(G.full, w), { fg: MUTED })], w);
  }
  const t = TONES[st];
  return btn([
    S(rep(' ', w), { bg: t.c }),
    S(`  ${label}  `, { fg: t.on, bg: t.c, bold: true }),
    S(rep(' ', w), { bg: t.c }),
  ], w);
});

sample('pill with a shadow', `a dim ${G.upper} offset one cell - depth without a second colour`, (label, st) => {
  const w = label.length + 5;
  const inner = label.length + 4;
  const face = st === 'rest'
    ? S(G.right, { fg: MUTED }) + S(` ${label} `, { fg: MUTED }) + S(G.left, { fg: MUTED }) + ' '
    : S(G.right, { fg: TONES[st].c })
      + S(` ${label} `, { fg: TONES[st].on, bg: TONES[st].c, bold: true })
      + S(G.left, { fg: TONES[st].c }) + ' ';
  return btn([face, ' ' + S(rep(G.upper, inner), { fg: SHADOW })], w);
});

sample('underline', `${G.upper} under the label - the lightest possible affordance`, (label, st) => {
  const w = label.length + 2;
  if (st === 'rest') return btn([S(` ${label} `, { fg: MUTED }), rep(' ', w)], w);
  const t = TONES[st];
  return btn([S(` ${label} `, { fg: t.c, bold: true }), S(rep(G.upper, w), { fg: t.c })], w);
});

for (const [name, spec] of Object.entries(BOXES)) {
  const b = box(spec);
  sample(`box ${name}, outline`, 'the frame takes the tone, nothing is filled', (label, st) => {
    const w = label.length + 4;
    const colour = st === 'rest' ? MUTED : TONES[st].c;
    const label_ = st === 'rest'
      ? S(` ${label} `, { fg: MUTED })
      : S(` ${label} `, { fg: TONES[st].c, bold: true });
    return btn([
      S(b.tl + rep(b.top, w - 2) + b.tr, { fg: colour }),
      S(b.side, { fg: colour }) + label_ + S(b.side, { fg: colour }),
      S(b.bl + rep(b.bottom, w - 2) + b.br, { fg: colour }),
    ], w);
  });

  sample(`box ${name}, filled inside`, 'THE GAP: the frame cell keeps the backdrop', (label, st) => {
    const w = label.length + 4;
    const colour = st === 'rest' ? MUTED : TONES[st].c;
    const t = st === 'rest' ? null : TONES[st];
    const middle = t
      ? S(b.side, { fg: t.c }) + S(` ${label} `, { fg: t.on, bg: t.c, bold: true }) + S(b.side, { fg: t.c })
      : S(b.side, { fg: MUTED }) + S(` ${label} `, { fg: MUTED }) + S(b.side, { fg: MUTED });
    return btn([
      S(b.tl + rep(b.top, w - 2) + b.tr, { fg: colour }),
      middle,
      S(b.bl + rep(b.bottom, w - 2) + b.br, { fg: colour }),
    ], w);
  });

  sample(`box ${name}, filled through`, 'the fill runs under the frame too - no gap, but a block', (label, st) => {
    const w = label.length + 4;
    if (st === 'rest') {
      return btn([
        S(b.tl + rep(b.top, w - 2) + b.tr, { fg: MUTED }),
        S(b.side + ` ${label} ` + b.side, { fg: MUTED }),
        S(b.bl + rep(b.bottom, w - 2) + b.br, { fg: MUTED }),
      ], w);
    }
    const t = TONES[st];
    const on = { fg: t.on, bg: t.c };
    return btn([
      S(b.tl + rep(b.top, w - 2) + b.tr, on),
      S(b.side + ` ${label} ` + b.side, { ...on, bold: true }),
      S(b.bl + rep(b.bottom, w - 2) + b.br, on),
    ], w);
  });
}

// --- output ------------------------------------------------------------

const LABEL = 'Palette';
const rule = (text) => S(text, { fg: MUTED, dim: true });

function glyphTable() {
  const rows = [
    [G.full, 'U+2588', 'full block'],
    [G.upper, 'U+2580', 'upper half'],
    [G.lower, 'U+2584', 'lower half'],
    [G.left, 'U+258C', 'left half'],
    [G.right, 'U+2590', 'right half'],
    [G.qUpperLeft, 'U+2598', 'quadrant upper left'],
    [G.qUpperRight, 'U+259D', 'quadrant upper right'],
    [G.qLowerLeft, 'U+2596', 'quadrant lower left'],
    [G.qLowerRight, 'U+2597', 'quadrant lower right'],
    [G.shadeLight, 'U+2591', 'light shade'],
    [G.shadeMed, 'U+2592', 'medium shade'],
  ];
  console.log(rule('  the glyphs these samples draw with'));
  console.log();
  for (let i = 0; i < rows.length; i += 4) {
    console.log(
      '  ' + rows.slice(i, i + 4)
        .map(([g, cp, name]) => `${S(g, { fg: TONES.primary.c })} ${S(cp, { fg: MUTED })} ${name.padEnd(20)}`)
        .join(''),
    );
  }
}

const only = process.argv[2] ? Number(process.argv[2]) : null;

console.log();
console.log(`  ${BOLD}Button glyph sampler${RESET}  ${S('- rest, then selected in three tones', { fg: MUTED })}`);
console.log();
glyphTable();
console.log();

/**
 * The shortlist, in the shape the decision is actually made in: a toolbar
 * where one button is focused and its neighbours are not. A style that looks
 * fine alone can still read backwards next to three of its own kind.
 */
const SHORTLIST = [
  'the pair: outline at rest, slab when filled',
  'the pair, as TextUI now draws it',
  'half-block caps',
  'rounded slab',
  'block outline',
  'box rounded, filled inside',
];

SAMPLES.forEach((s, i) => {
  const n = i + 1;
  if (only !== null && only !== n) return;
  console.log(rule(`  ${String(n).padStart(2, '0')} ${'─'.repeat(2)} `) + `${BOLD}${s.title}${RESET}`);
  console.log(rule(`       ${s.note}`));
  console.log();
  const buttons = ['rest', 'primary', 'success', 'danger'].map((st) => s.render(LABEL, st));
  for (const line of row(buttons)) console.log('    ' + line);
  console.log();
});

if (only === null) {
  console.log(rule('  ' + '─'.repeat(60)));
  console.log(`  ${BOLD}in context${RESET}  ${S('- a toolbar with the second button focused', { fg: MUTED })}`);
  console.log();
  for (const title of SHORTLIST) {
    const s = SAMPLES.find((x) => x.title === title);
    console.log(rule(`  ${String(SAMPLES.indexOf(s) + 1).padStart(2, '0')} ${s.title}`));
    const buttons = ['Dialog', 'Palette', 'Confirm', 'Prompt']
      .map((l, i) => s.render(l, i === 1 ? 'primary' : 'rest'));
    for (const line of row(buttons, 2)) console.log('    ' + line);
    console.log();
  }
}
