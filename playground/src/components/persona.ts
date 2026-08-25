/**
 * A persona: a small figure assembled from parts, rather than drawn whole.
 *
 * The chat example's `bood` deliberately does the opposite - one creature per
 * file, drawn by hand at each size, with a comment saying that "a creature
 * that fits a template is a template wearing a hat". That is right for what it
 * is: a still figure whose whole job is to look drawn.
 *
 * This is the other trade. A persona is a puppet, and the point is that its
 * parts recombine - so the head is a shape with a window in it, the eyes are
 * what goes in the window, and a hat belongs to nobody in particular.
 *
 * Five rows, seven columns:
 *
 * ```
 *   |"|      row 0   the hat
 *  _|_|_     row 1   ...which is two rows, and often only uses this one
 *  (oo )     row 2   the head, with the eyes set into it
 *  [[T]]     row 3   the middle
 *   J L      row 4   the feet
 * ```
 *
 * The rows are fixed because the parts have to line up when they are swapped:
 * a head two rows tall in one persona and one row tall in another cannot share
 * a body, and a hat that changed how tall somebody is would be a hat that
 * decided where their feet go.
 */

/** How the eyes are set. Everything else is the same figure. */
export const MOODS = ['normal', 'happy', 'angry', 'sleepy'] as const;
export type Mood = typeof MOODS[number];

/** Which way the figure is facing. `normal` is towards the reader. */
export const SIDES = ['normal', 'left', 'right'] as const;
export type Side = typeof SIDES[number];

/** One row of a part, per frame. `[0]` is the still, and the rest is the walk. */
export type Path = string[];

/**
 * A part, per facing.
 *
 * Only `normal` is required. A part with no `left` uses its `normal` - which
 * is right for feet that look the same either way, and stops a persona from
 * having to state three versions of a body that never changes.
 */
export interface Sided {
  normal: Path;
  left?: Path;
  right?: Path;
}

/**
 * A hat, which is nobody's in particular.
 *
 * Two rows, and separate from the persona on purpose: a hat that were a field
 * on a figure could only ever be worn by that figure, and the whole question
 * was how to put this one on somebody else. So it is its own thing, and
 * `drawPersona` takes one.
 *
 * Most hats only use the lower row and leave the upper one blank. The row is
 * still there, because a hat that borrowed a row from the head would move the
 * face down for anyone wearing a tall one.
 */
export interface HatSpec {
  name: string;
  label: string;
  /** Row 0 and row 1. Either may be blank. */
  rows: [Sided, Sided];
}

export interface PersonaSpec {
  name: string;
  label: string;
  /**
   * Row 2, with a window in it.
   *
   * Written with the eye socket left blank - `' (   ) '` - because the eyes
   * are stamped into it rather than drawn beside it. That is what makes a
   * mood four short strings instead of four whole heads.
   */
  head: Sided;
  /**
   * What goes in the window: per mood, and per facing within each mood.
   *
   * Both, because they are different questions. A mood is which eyes -
   * `oo`, `^^`, `><` - and a facing is what those eyes do when the figure
   * turns, which is sometimes only moving (`eyeAt` does that) and sometimes a
   * different drawing: a bug whose eyes fill its whole head cannot shift them,
   * but it can look `<,o` instead of `o,o`.
   *
   * A mood with no `left` uses its `normal`, so a persona that turns by moving
   * its eyes states each mood once.
   */
  eyes: Record<Mood, Sided>;
  /**
   * Where the eyes sit inside the head, per facing.
   *
   * This is the whole of "looking left": the head does not change, the eyes
   * move within it. A figure that redrew its head to look sideways would need
   * one head per mood per side, which is the combinatorial explosion this
   * shape exists to avoid.
   */
  eyeAt: Record<Side, number>;
  /** Row 3. The body, the arms, whatever is in the middle. */
  middle: Sided;
  /** Row 4. */
  foot: Sided;
}

export const WIDTH = 7;
export const HEIGHT = 5;

/** Identity, for the inference. A persona file is data and stays data. */
export const definePersona = (spec: PersonaSpec): PersonaSpec => spec;
export const defineHat = (spec: HatSpec): HatSpec => spec;

/**
 * The frame for one facing, at one point along the walk.
 *
 * `at` indexes every part's path independently and wraps, so parts with paths
 * of different lengths stay in step with themselves rather than with each
 * other - two feet and a four-frame tail is a figure whose tail is not tied to
 * its stride, which is what you want.
 */
export function frameOf(part: Sided, side: Side, at: number): string {
  return pad(pathOf(part, side, at));
}

/**
 * The same, unpadded.
 *
 * The eyes are two or three cells and go *into* a row rather than being one,
 * so padding them to seven would stamp five spaces of nothing over the head
 * they are supposed to sit in.
 */
export function pathOf(part: Sided, side: Side, at: number): string {
  const path = (side === 'left' ? part.left : side === 'right' ? part.right : undefined)
    ?? part.normal;
  return path[Math.abs(at) % path.length] ?? '';
}

/** Seven cells, centred on what was written. A short row is not a broken one. */
function pad(row: string): string {
  const cells = [...row];
  if (cells.length >= WIDTH) return cells.slice(0, WIDTH).join('');
  const before = Math.floor((WIDTH - cells.length) / 2);
  return ' '.repeat(before) + cells.join('') + ' '.repeat(WIDTH - cells.length - before);
}

/**
 * The eyes, into the head's window.
 *
 * Written over rather than merged: a cell of the eyes replaces the cell of the
 * head under it, blanks included, so `'o o'` really does leave a gap of head
 * showing between them.
 */
function withEyes(head: string, eyes: string, at: number): string {
  const cells = [...head];
  [...eyes].forEach((cell, i) => {
    if (at + i >= 0 && at + i < cells.length) cells[at + i] = cell;
  });
  return cells.join('');
}

export interface DrawOptions {
  side?: Side;
  mood?: Mood;
  /** Where along the walk. Zero is the still. */
  at?: number;
  /** Whose hat, if anybody's. */
  hat?: HatSpec | null;
}

/** A persona as five rows of seven cells, in a hat or not. */
export function drawPersona(spec: PersonaSpec, options: DrawOptions = {}): string[] {
  const { side = 'normal', mood = 'normal', at = 0, hat = null } = options;
  const blank = ' '.repeat(WIDTH);
  const eyes = spec.eyes[mood] ?? spec.eyes.normal;
  return [
    hat ? frameOf(hat.rows[0], side, at) : blank,
    hat ? frameOf(hat.rows[1], side, at) : blank,
    withEyes(frameOf(spec.head, side, at), pathOf(eyes, side, at), spec.eyeAt[side]),
    frameOf(spec.middle, side, at),
    frameOf(spec.foot, side, at),
  ];
}

/**
 * What is wrong with a persona or a hat, if anything.
 *
 * Checked rather than trusted, for the reason `registerCreature` checks its
 * art: a row one cell too wide does not look wide on somebody else's terminal,
 * it looks broken, and the moment to find out is now rather than the first
 * time it walks past a cloud.
 */
export function checkPersona(spec: PersonaSpec): string[] {
  const wrong = sided(spec.name, [
    ['head', spec.head], ['middle', spec.middle], ['foot', spec.foot],
  ]);
  wrong.push(...sided(spec.name, MOODS.map((mood) => [`eyes.${mood}`, spec.eyes[mood]])));
  for (const side of SIDES) {
    const at = spec.eyeAt[side];
    if (at < 0 || at >= WIDTH) wrong.push(`${spec.name}: eyeAt.${side} is outside the head`);
  }
  return wrong;
}

export function checkHat(spec: HatSpec): string[] {
  return sided(spec.name, [['rows[0]', spec.rows[0]], ['rows[1]', spec.rows[1]]]);
}

function sided(name: string, parts: [string, Sided | undefined][]): string[] {
  const wrong: string[] = [];
  for (const [part, sides] of parts) {
    if (!sides) { wrong.push(`${name}: ${part} is missing`); continue; }
    for (const side of SIDES) {
      const path = side === 'normal' ? sides.normal : sides[side];
      if (!path) continue;
      if (path.length === 0) wrong.push(`${name}: ${part}.${side} has no frames`);
      path.forEach((row, i) => {
        if ([...row].length > WIDTH) {
          wrong.push(`${name}: ${part}.${side}[${i}] is ${[...row].length} cells, over ${WIDTH}`);
        }
      });
    }
  }
  return wrong;
}
