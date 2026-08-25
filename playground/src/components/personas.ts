import { defineHat, definePersona } from './persona.js';

/**
 * The cast, and the hatstand.
 *
 * Two lists, because they are two things: any hat goes on any persona, which
 * is the whole reason the hat is not a field on the figure. `drawPersona(bug,
 * { hat: HATS[1] })` is a bug in an owl's cap, and nothing had to be redrawn
 * for it.
 *
 * Every glyph is CP437 - the set a console font is guaranteed to have -
 * because the alternative is a Windows console printing the figure as a row of
 * empty boxes, which is what happened to the flowers. `J` and `'` stand in for
 * the `⅃` and `´` of the original sketch and draw the same shapes.
 *
 * The paths are what makes a walk. Frame 0 is the still - it is what shows
 * with animation off, in a test and in a snapshot - and the rest is the
 * stride, so a figure standing about looks like the drawing rather than like a
 * frozen animation.
 */

/** Feet mid-stride, which is the whole of the walk cycle for most of these. */
const STRIDE = { normal: [' J L ', ' J  L', ' J L ', 'J  L '] };

/**
 * Eyes shifted within the head - which is the whole of "looking sideways".
 *
 * The window in ` (   ) ` is three cells, so a pair of eyes has exactly two
 * places to be: against the left of it or against the right. `normal` and
 * `left` are therefore the same position, and that is honest rather than a
 * bug - there is no third place for them at seven cells wide.
 *
 * A figure that wants a real profile gives its `head` a `left` and a `right`
 * of its own; the eyes moving is the cheap version that costs nothing to draw.
 */
const EYES_AT = { normal: 2, left: 2, right: 3 };

/** Three-cell eyes fill the window, so those figures do not turn their heads. */
const EYES_FILL = { normal: 2, left: 2, right: 2 };

export const HATS = [
  defineHat({
    name: 'none',
    label: 'Bare-headed',
    rows: [{ normal: ['       '] }, { normal: ['       '] }],
  }),
  defineHat({
    name: 'cap',
    label: 'Cap',
    rows: [{ normal: ['  |"|  '] }, { normal: [' _|_|_ '] }],
  }),
  defineHat({
    name: 'cans',
    label: 'Headphones',
    rows: [{ normal: [' _   _ '] }, { normal: ['(_)-(_)'] }],
  }),
  defineHat({
    name: 'spark',
    label: 'Spark',
    // Two frames, so it twinkles where the rest of the figure is still.
    rows: [{ normal: ['       '] }, { normal: ["  '*`  ", "  `*'  "] }],
  }),
  defineHat({
    name: 'crown',
    label: 'Crown',
    rows: [{ normal: ['       '] }, { normal: [' \\-^-/ '] }],
  }),
  defineHat({
    name: 'aerial',
    label: 'Aerial',
    rows: [{ normal: ['       '] }, { normal: ['  |||  ', '  \\|/  '] }],
  }),
];

/** The head is written with its eye socket empty; the eyes go into it. */
export const owl = definePersona({
  name: 'owl',
  label: 'Owl',
  head: { normal: [' (   ) '] },
  // Turns by moving its eyes, so each mood is one drawing. The sleepy one
  // has a third frame, which is a blink: a path is per part, so an owl can
  // blink at its own rate without anything else being told about it.
  eyes: {
    normal: { normal: ['oo'] },
    happy: { normal: ['^^'] },
    angry: { normal: ['><'] },
    sleepy: { normal: ['--', '--', '--', 'oo'] },
  },
  eyeAt: EYES_AT,
  middle: { normal: [' [[T]] '] },
  foot: STRIDE,
});

export const bug = definePersona({
  name: 'bug',
  label: 'Bug',
  head: { normal: ['//   \\\\'] },
  // Its eyes fill the whole window, so it cannot turn by moving them - it
  // turns by *being drawn* looking that way. This is the case `Sided` eyes
  // exist for.
  eyes: {
    normal: { normal: ['o,o'], left: ['<,o'], right: ['o,>'] },
    happy: { normal: ['^,^'], left: ['<,^'], right: ['^,>'] },
    angry: { normal: ['*,*'], left: ['<,*'], right: ['*,>'] },
    sleepy: { normal: ['-,-'] },
  },
  eyeAt: EYES_FILL,
  middle: { normal: ['///_\\\\\\'] },
  foot: STRIDE,
});

export const bot = definePersona({
  name: 'bot',
  label: 'Bot',
  // Turns both ways at once: the head is drawn per side *and* the eyes are.
  // A `q` becoming a `(` is the ear the figure has turned away from.
  head: { normal: [' q   p '], left: [' (   p '], right: [' q   ) '] },
  eyes: {
    normal: { normal: ['o O'], left: ['OO '], right: [' OO'] },
    happy: { normal: ['^ ^'] },
    angry: { normal: ['o o'] },
    // Two frames, so a sleeping bot has a light that comes and goes.
    sleepy: { normal: ['_ _', '_ _', '. .'] },
  },
  eyeAt: EYES_FILL,
  middle: { normal: [' /|||\\ '] },
  foot: STRIDE,
});

export const pip = definePersona({
  name: 'pip',
  label: 'Pip',
  head: { normal: [' (   ) '] },
  eyes: {
    normal: { normal: ['oo'] },
    happy: { normal: ['^^'] },
    angry: { normal: ['..'] },
    sleepy: { normal: ['__'] },
  },
  eyeAt: EYES_AT,
  middle: { normal: [' /(_)\\ '] },
  foot: STRIDE,
});

export const PERSONAS = [owl, bug, bot, pip];
