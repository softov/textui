import {
  defineComponent, useCapabilities, useInput, useMeasure, useMemo, useState, useTicker,
} from '@textui/core';
import type { RenderOutput, StyleColor } from '@textui/core';
import { Column, KeyHints, Row } from '@textui/widgets';
import { Pattern } from '../components/pattern.js';
import { HEIGHT as PERSONA_HEIGHT, WIDTH as PERSONA_WIDTH, drawPersona } from '../components/persona.js';
import { MOODS } from '../components/persona.js';
import type { Mood, Side } from '../components/persona.js';
import { HATS, PERSONAS } from '../components/personas.js';

/**
 * A scene: sky over earth, with things scattered on both.
 *
 * Two patterns as ground and firmament, and sprites placed on top of them at
 * positions nobody chose. It exercises the three things a background is
 * actually for - filling a box whose size is only known after layout, staying
 * behind what is drawn over it, and degrading to something a plain terminal
 * can print.
 *
 * Everything random here is *seeded*. A component re-renders whenever anything
 * it reads changes, so a scene that called `Math.random()` while painting
 * would deal a new sky on every keystroke and a different one in a test than
 * on the screen. The seed is state: `r` deals again, and until it does the
 * scene is the same scene.
 *
 * The horizon is 60/40 rather than a half. An even split reads as a diagram;
 * a low horizon reads as a landscape, and it leaves the sky the room that the
 * clouds - which are the only thing here with space around it - need.
 */

/**
 * A small deterministic generator.
 *
 * `mulberry32`, which is thirty characters and good enough for placing a
 * flower. The point is not statistical quality, it is that the same seed is
 * the same scene - on the screen, in a snapshot and in a test.
 */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The sprites, twice.
 *
 * A pattern takes an `ascii` tile because the library cannot guess a
 * substitute for glyphs it has never seen, and the same is true of anything
 * drawn by hand. These are the ranges that do not survive an `unicode: 'ascii'`
 * terminal, so the flower's stem is `|` in both alphabets rather than `│` in
 * one: a stem is one cell of a three-cell drawing, and a drawing that loses a
 * third of itself is not a fallback.
 */
interface Sprites {
  sky: string[];
  earth: string[];
  /** A cloud is drawn in two densities: a soft rim and a solid middle. */
  cloud: { edge: string; core: string };
  sun: string[];
  blooms: string[];
  /** A flower's lower rows: the leafy one, and the one it stands on. */
  stems: { leaf: string[]; base: string[] };
  tuft: string;
}

const UNICODE: Sprites = {
  sky: [
    '                                                        ',
    '   .                                                    ',
    '                                                   *    ',
    '                                                        ',
    '                                                        ',
    '                                                        ',
    '                                                        ',
    '               *                                        ',
  ],
  earth: [
    '   ·       ',
    '       ,   ',
    '           ',
    ' .         ',
  ],
  cloud: { edge: '░', core: '▒' },
  sun: [
    ' \\,|,/',
    '--░░░--',
    " /'|`\\ ",
  ],
  /*
   * Not the Dingbat flowers. `❀ ✿ ❁ ✾ ❃` are U+2740-ish, and a Windows
   * console prints every one of them as an empty box: the font has no glyph,
   * and no capability says so. `unicode` has three tiers - ascii, bmp, full -
   * and none of them means "the font shipped with this terminal actually has
   * that codepoint". A terminal that reports `full` still draws tofu.
   *
   * These are all in CP437, which is the set a console font is guaranteed to
   * have because it is the set the console was built on.
   */
  blooms: ['☼', '*', '♣', '○', '•'],
  stems: {
    leaf: [' |', ' ┤', ' ├~', '~┤', ' |´', '`|', ' ├<~'],
    base: [' /', '  \\', '/┤', ' ├ ', '/|', '/|', '/|\\'],
  },
  tuft: '· , . ',
};

const ASCII: Sprites = {
  sky: [
    '              ',
    '        .     ',
    '              ',
    '              ',
    '   .          ',
    '              ',
  ],
  earth: [
    "   '                      ",
    '           ,              ',
    '                          ',
    ' .                        ',
    '                          ',
    '                          ',
    '                   .      ',
    '                          ',
    '                          ',
  ],
  cloud: { edge: '.', core: ':' },
  sun: [
    ' \\ | / ',
    '- O -',
    ' / | \\ ',
  ],
  blooms: ['*', 'o', '@', '+', 'x'],
  // The same shapes without the box-drawing. `├` and `┤` are exactly what an
  // ascii terminal cannot print, and a stem is one cell of a three-cell
  // drawing - lose it and the flower is a bloom hanging in the air.
  stems: {
    leaf: [' |', " |'", ' |~', '~|', " |'", '`|', ' |<~'],
    base: [' /', '  \\', '/|', ' | ', '/|', '/|', '/|\\'],
  },
  tuft: "' , . ",
};

/*
 * A backslash in a drawing has to be written twice.
 *
 * `'\\ | /'` is an escaped space in a TypeScript string, so a sun drawn with
 * single backslashes loses its left-hand rays silently - no error, no warning,
 * just a ray that is a space. It is the one thing that bites every time
 * somebody draws here, and it costs a glance at the frame to notice.
 */

/**
 * A bloom is a colour as well as a glyph.
 *
 * Five flowers in one green is a pattern; five in four colours is a meadow.
 * Semantic tokens rather than literals, so the scene follows a theme change
 * instead of staying in whatever palette it was written against.
 */
// Not `inverted`: it is the theme's colour for text *on* an accent, which in
// a dark theme is near-black - a black petal reads as a dead flower rather
// than as a white one. `text` is the pale end of the palette, which is what a
// daisy wants.
const PETALS: StyleColor[] = ['danger', 'warning', 'text', 'secondary', 'accent'];

/**
 * The stem, and why it is a colour rather than a token.
 *
 * Every stem is the same green, because a meadow with five colours of stem is
 * a bag of pipe cleaners - the variety belongs to the blooms, and the stems
 * are what makes them read as the same kind of thing.
 *
 * The palette has no dark green. `success` is the ground's own colour, so a
 * stem in it is invisible, and `onSuccess` is the near-black the theme uses
 * for marks on that ground - correct for texture and wrong for a stem, which
 * is supposed to look alive. A literal is the honest answer: this one sits
 * darker than the light-green ground of a dark theme and lighter than the
 * deep green of a light one, so it reads either way.
 */
const STEM: StyleColor = '#3f7d4a';

/**
 * A cloud, built rather than chosen.
 *
 * Three sprites in a list is three clouds in the sky and you can see it - the
 * eye finds the repeat immediately, and a scene where every cloud is one of
 * three is wallpaper. So a cloud is a stack of runs, widest at the bottom,
 * each one starting and ending a cell or two off its neighbour. That is
 * enough to make every cloud a different cloud without anybody drawing one.
 *
 * Two densities rather than one: the first and last cell of each run is the
 * lighter glyph and the middle is the solid one, so the rim fades into the
 * sky instead of ending at a hard edge. Shade blocks do the blending
 * themselves - `░` is a quarter of the foreground over the background - which
 * is why the cloud reads as white-ish over blue rather than as a shape in one
 * flat colour.
 */
function cloud(next: () => number, art: Sprites['cloud']): string[] {
  const width = 9 + Math.floor(next() * 10);
  const height = next() < 0.45 ? 3 : 2;
  const rows: string[] = [];

  for (let r = 0; r < height; r++) {
    // Widest at the bottom: a cloud sits on its own base. The inset is per
    // row and jittered, so the two sides are not a mirror of each other -
    // which is what makes it a cloud rather than a lens.
    const shrink = height - 1 - r;
    const from = shrink * 2 + Math.floor(next() * 2);
    const to = width - shrink * 2 - Math.floor(next() * 2);
    const cells: string[] = Array.from({ length: width }, () => ' ');
    for (let i = Math.max(0, from); i < Math.min(width, to); i++) {
      cells[i] = i === from || i === to - 1 ? art.edge : art.core;
    }
    rows.push(cells.join(''));
  }
  return rows;
}

/**
 * The paintable runs of a row, so the spaces in it stay see-through.
 *
 * A `text` paints every cell it is given, spaces included, in whatever
 * background it inherits. For a figure standing over a scene that is a black
 * rectangle around it - the seven-by-five box it occupies, filled with the
 * application's own background instead of the sky behind it. Splitting the
 * row and drawing only the marks is what makes it a figure rather than a
 * sticker.
 */
function marks(row: string): { at: number; text: string }[] {
  const cells = [...row];
  const out: { at: number; text: string }[] = [];
  let start = -1;
  for (let i = 0; i <= cells.length; i++) {
    const paint = i < cells.length && cells[i] !== ' ';
    if (paint && start < 0) start = i;
    else if (!paint && start >= 0) {
      out.push({ at: start, text: cells.slice(start, i).join('') });
      start = -1;
    }
  }
  return out;
}

/**
 * The horizon, dealt rather than repeated.
 *
 * `'· , . '.repeat(n)` is a dashed line: the eye reads the six-cell period
 * immediately and what should be the edge of a field becomes a border. Taking
 * each cell from the same alphabet at random keeps the density and loses the
 * rhythm - and the blanks in the alphabet are what make it grass rather than
 * a solid rule.
 */
function horizon(alphabet: string, width: number, next: () => number): string {
  const marks = [...alphabet];
  return Array.from(
    { length: Math.max(0, width) },
    () => marks[Math.floor(next() * marks.length)] as string,
  ).join('');
}

/**
 * One flower: a bloom, a leafy middle if it is a tall one, and a base.
 *
 * The stem is dealt from the same generator as everything else rather than
 * from `Math.random()`. A component re-renders whenever its box changes, so a
 * shape rolled while painting is a flower that grows a new stem on every
 * keystroke and shivers while the window is being dragged - and it would make
 * the scene different in a test than on the screen, which is the one thing a
 * seeded scene is for.
 */
function flower(bloom: string, tall: boolean, next: () => number, stems: Sprites['stems']): string[] {
  const pick = (from: string[]): string => from[Math.floor(next() * from.length)] as string;
  // Two rows is a flower and three is a taller one. Both start with the bloom,
  // so a row of them reads as a row of flowers at different heights rather
  // than as two different drawings.
  return tall
    ? [` ${bloom}`, pick(stems.leaf), pick(stems.base)]
    : [` ${bloom}`, pick(stems.base)];
}

interface Placed {
  key: string;
  top: number;
  left: number;
  rows: string[];
  /** Which of the sprite list it came from, so a caller can colour by kind. */
  kind: number;
}

/**
 * Scatter sprites across a box, without letting two share a column.
 *
 * Overlap is the whole difficulty. Two clouds on the same rows a cell apart
 * are not two clouds, they are one smear - so a column that has been taken is
 * taken, and a draw that lands on one is simply skipped. Skipped rather than
 * retried: a retry loop on a box too narrow for what was asked never ends,
 * and "as many as fit" is the honest answer to "twelve, please" on a
 * forty-column terminal.
 */
function scatter(
  sprites: string[][],
  count: number,
  room: { width: number; height: number },
  rows: { from: number; to: number },
  next: () => number,
  prefix: string,
  /**
   * How far a sprite may hang past the left and right edges.
   *
   * Zero keeps every sprite whole, which is what a flower wants - one cut in
   * half at the edge reads as a rendering fault. A cloud is the opposite: a
   * sky where every cloud is comfortably inside the frame is a diagram of
   * clouds, and one drifting off the edge is what says the sky continues.
   */
  bleed = 0,
): Placed[] {
  const out: Placed[] = [];
  const taken: { left: number; right: number; top: number; bottom: number }[] = [];
  const span = Math.max(0, rows.to - rows.from);
  if (room.width <= 0 || span <= 0) return out;

  for (let i = 0; i < count; i++) {
    // Each draw picks a shape. With a list of one-offs - clouds, which are
    // generated rather than chosen - `count` matches the list and this walks
    // it; with a small list of reusable sprites it repeats them, which is
    // what a field of flowers wants.
    const kind = sprites.length === count ? i : Math.floor(next() * sprites.length);
    const art = sprites[kind] as string[];
    const width = Math.max(...art.map((row) => [...row].length));
    const height = art.length;
    if (width > room.width + bleed * 2 || height > span) continue;

    const range = room.width - width + 1 + bleed * 2;
    const left = Math.floor(next() * Math.max(1, range)) - bleed;
    const top = rows.from + Math.floor(next() * (span - height + 1));
    // Both axes, with a cell of air either side. Columns alone was too
    // strict: two flowers three rows apart never share a row of the screen,
    // and forbidding them the same column flattens a field into a single
    // line of evenly spaced stems.
    const it = { left: left - 1, right: left + width + 1, top, bottom: top + height };
    if (taken.some((t) => it.left < t.right && it.right > t.left
      && it.top < t.bottom && it.bottom > t.top)) continue;

    taken.push(it);
    out.push({ key: `${prefix}${i}`, top, left, rows: art, kind });
  }
  return out;
}

/**
 * A placed sprite, as absolutely positioned rows.
 *
 * `transparent` is the reason each row is its own `text` rather than one
 * block: a space inside a cloud is part of the cloud and paints over the sky,
 * while a space *around* one is not drawn at all - so the rows are trimmed at
 * the ends and placed at the offset that trimming cost.
 */
function draw(
  placed: Placed[],
  tone: StyleColor | ((kind: number, row: number) => StyleColor),
): RenderOutput[] {
  return placed.flatMap((sprite) => sprite.rows.flatMap((row, i) => {
    const lead = row.length - row.trimStart().length;
    const text = row.trim();
    if (text === '') return [];
    return [(
      <text
        key={`${sprite.key}:${i}`}
        position="absolute"
        top={sprite.top + i}
        left={sprite.left + lead}
        content={text}
        fg={typeof tone === 'function' ? tone(sprite.kind, i) : tone}
        wrap="none"
      />
    )];
  }));
}

/**
 * What the bands are handed so a figure can stand on them.
 *
 * In screen cells, not in anybody's local coordinates. A figure that straddles
 * the horizon has to be drawn by *both* bands - each one painting the rows it
 * covers - because a cell's background comes from the box that drew it, and
 * the sky and the ground are two different boxes. Drawn once in a layer over
 * the top, the figure would carry the layer's own background with it: a
 * seven-by-five rectangle of the application's canvas, cut out of the scene.
 */
interface Figure {
  rows: string[];
  /** Absolute, so each band can subtract its own origin. */
  x: number;
  y: number;
}

/** The figure, clipped to and coloured by whichever band is drawing it. */
function standing(figure: Figure | null, rect: { x: number; y: number }): RenderOutput[] {
  if (!figure) return [];
  return figure.rows.flatMap((row, i) => marks(row).map((run) => (
    <text
      key={`p${i}:${run.at}`}
      position="absolute"
      top={figure.y - rect.y + i}
      left={figure.x - rect.x + run.at}
      content={run.text}
      fg={i === 0 ? 'warning' : 'text'}
      wrap="none"
    />
  )));
}

const SkyBand = defineComponent<{ seed: number; art: Sprites; figure: Figure | null }>('SceneSky', (props) => {
  const { seed, art, figure } = props;
  const room = useMeasure();

  // Keyed on the size as well as the seed: a cloud placed for an eighty-column
  // sky has to be placed again for a forty-column one, or half of them are
  // off the edge and the rest are all on the left.
  const clouds = useMemo(() => {
    const next = random(seed);
    // Built first, then placed, so the shapes come out of the same deal as
    // the positions - one seed, one sky.
    const shapes = Array.from({ length: 5 + Math.floor(next() * 4) }, () => cloud(next, art.cloud));
    // Below the top row, which the sun has: a cloud drawn through it reads as
    // damage rather than as weather. `bleed` lets one drift off the edge.
    return scatter(shapes, shapes.length, room, { from: 1, to: room.height }, next, 'c', 4);
  }, [seed, room.width, room.height, art]);

  const sunWidth = Math.max(...art.sun.map((row) => [...row].length));
  return (
    <Pattern
      tile={art.sky}
      ascii={ASCII.sky}
      x={-1}
      y={-1}
      // Evenly spaced marks read as graph paper: the eye finds the rhythm in
      // about a second and stops seeing sky. Cells, not a fraction - up to
      // this much more air between one copy and the next.
      jitter={{ x: 22, y: 5 }}
      seed={seed}
      flex={6}
      bg="info"
      fg="onInfo"
      overflow="hidden"
    >
      {draw(clouds, 'text')}
      {standing(figure, room)}
      {/* Placed rather than scattered. There is one sun and it is where it
          always is, so a seed that moved it would be dealing weather and
          astronomy from the same deck. */}
      {draw(
        [{ key: 'sun', top: 0, left: Math.max(0, room.width - sunWidth - 2), rows: art.sun, kind: 0 }],
        'warning',
      )}
    </Pattern>
  );
});

const EarthBand = defineComponent<{ seed: number; art: Sprites; figure: Figure | null }>('SceneEarth', (props) => {
  const { seed, art, figure } = props;
  const room = useMeasure();

  const flowers = useMemo(() => {
    const next = random(seed ^ 0x9e3779b9);
    const blooms = art.blooms.flatMap((bloom) => [
      flower(bloom, true, next, art.stems),
      flower(bloom, false, next, art.stems),
    ]);
    // Anywhere in the band, not all on the last row. A field seen from the
    // side has depth: the near ones are low on the screen and the far ones
    // are up by the horizon, and a row of stems sharing one baseline is a
    // fence rather than a meadow.
    return scatter(blooms, 17, room, { from: 1, to: room.height }, next, 'f');
  }, [seed, room.width, room.height, art]);

  return (
    <Pattern
      tile={art.earth}
      ascii={ASCII.earth}
      x={-1}
      y={-1}
      jitter={{ x: 9, y: 3 }}
      seed={seed}
      flex={4}
      bg="#2c3123"
      fg="#1a571a"
      overflow="hidden"
    >
      {/* The horizon. Two flat colours meeting is a seam; the same two with a
          row of grass along it is a field starting. */}
      <text
        position="absolute"
        top={0}
        left={0}
        content={horizon(art.tuft, room.width, random(seed ^ 0x85ebca6b))}
        fg="onSuccess"
        wrap="none"
      />
      {/* The bloom is the first row and everything under it is the plant.
          One green for all of them; the colour belongs to the flower. */}
      {draw(flowers, (kind, row) => (
        row === 0 ? PETALS[Math.floor(kind / 2) % PETALS.length] as StyleColor : STEM
      ))}
      {standing(figure, room)}
    </Pattern>
  );
});

/**
 * Somebody in the scene, who goes where you point.
 *
 * The walk is a clock rather than a transition: one cell per tick towards the
 * target, and the same tick advances the stride, so the feet move at the speed
 * the figure travels rather than at a rate somebody guessed. When it arrives
 * the ticker stops - a still figure holds no ticker at all, which is what
 * keeps a scene with a persona in it as cheap as one without.
 *
 * This holds the state and draws nothing. The drawing is the bands', because a
 * cell's background belongs to the box that painted it: a figure drawn in a
 * layer of its own would carry that layer's background with it and appear as a
 * rectangle of canvas cut out of the sky. So the position is published in
 * screen cells and whichever band covers a row paints it, clipped to itself.
 */
function useWalker(
  who: number,
  hat: number,
  mood: Mood,
  rect: { x: number; y: number; width: number; height: number },
): { figure: Figure | null; goTo(to: { x: number; y: number }): void } {
  const spec = PERSONAS[who % PERSONAS.length];
  const floor = Math.max(0, rect.height - PERSONA_HEIGHT - 1);

  /*
   * `y: null` means "on the ground", which is not a number until the box has
   * been measured. Storing a guess instead - and drawing the floor while
   * pretending the figure was at zero - made the first tick after a click
   * teleport it to the top of the scene and walk it back down.
   */
  const [pos, setPos] = useState<{ x: number; y: number | null }>({ x: 2, y: null });
  const [target, setTarget] = useState<{ x: number; y: number } | null>(null);
  const [step, setStep] = useState(0);
  const [facing, setFacing] = useState<Side>('normal');

  const y = pos.y ?? floor;
  const going = target !== null && (target.x !== pos.x || target.y !== y);

  /** Inside the box, always. The figure is what has to fit, not its corner. */
  const inside = (to: { x: number; y: number }): { x: number; y: number } => ({
    x: Math.max(0, Math.min(Math.max(0, rect.width - PERSONA_WIDTH), to.x)),
    y: Math.max(0, Math.min(Math.max(0, rect.height - PERSONA_HEIGHT), to.y)),
  });

  // A step per press, rather than a target to walk to: the arrows *are* the
  // walking, so putting a destination between the key and the figure would
  // only add lag to something that is already one cell at a time.
  useInput((event) => {
    const by = ({
      left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
      up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
    } as Record<string, { x: number; y: number } | undefined>)[event.name];
    if (!by) return false;
    setTarget(null);
    setPos((from) => inside({ x: from.x + by.x, y: (from.y ?? floor) + by.y }));
    setStep((s) => s + 1);
    if (by.x !== 0) setFacing(by.x < 0 ? 'left' : 'right');
    return true;
  }, { global: true });

  useTicker(() => {
    if (!target) return;
    setPos((from) => {
      const was = from.y ?? floor;
      return {
        x: from.x + Math.sign(target.x - from.x),
        y: was + Math.sign(target.y - was),
      };
    });
    setStep((s) => s + 1);
  }, { fps: 12, enabled: going });

  const goTo = (to: { x: number; y: number }): void => {
    setFacing(to.x > pos.x ? 'right' : to.x < pos.x ? 'left' : facing);
    setTarget(inside(to));
  };

  if (!spec || rect.width === 0) return { figure: null, goTo };
  return {
    goTo,
    figure: {
    rows: drawPersona(spec, {
      hat: HATS[hat % HATS.length] ?? null,
      // The way it last moved, rather than front-on the moment it stops. A
      // figure that walked left and then turned to face you has turned for no
      // reason anybody watching can see.
      side: facing,
      mood,
      at: step,
    }),
    x: rect.x + pos.x,
    y: rect.y + y,
    },
  };
}

/**
 * The two bands and whoever is standing on them.
 *
 * A component of its own because the walker needs a measured box to live in,
 * and the click has to be translated out of screen cells into it - without
 * that the figure walks to a point offset by wherever the scene happens to be
 * on the terminal, which looks like a bug in the animation and is a bug in the
 * arithmetic.
 */
const Stage = defineComponent<{ seed: number; art: Sprites; who: number; hat: number; mood: Mood }>(
  'SceneStage',
  (props) => {
    const rect = useMeasure();
    const { figure, goTo } = useWalker(props.who, props.hat, props.mood, rect);
    return (
      <box
        position="relative"
        flex={1}
        direction="column"
        onMouse={(event: { action: string; x: number; y: number }) => {
          if (event.action !== 'down') return false;
          // Back off the figure's own size, so it stands *on* the pointer
          // rather than beside it.
          goTo({
            x: event.x - rect.x - Math.floor(PERSONA_WIDTH / 2),
            y: event.y - rect.y - PERSONA_HEIGHT + 1,
          });
          return true;
        }}
      >
        <SkyBand seed={props.seed} art={props.art} figure={figure} />
        <EarthBand seed={props.seed} art={props.art} figure={figure} />
      </box>
    );
  },
);

export const ScenePlayground = defineComponent<Record<string, never>>('ScenePlayground', () => {
  /*
   * A new scene per run, the same scene within one.
   *
   * Drawn once when this mounts, not on every render: a component re-renders
   * whenever its box changes, and a seed rolled during painting would deal a
   * new sky on every keystroke and crawl while the window was being dragged.
   * Rolled at all, because a scene that is identical every time it is started
   * is a picture rather than a generator - and the whole of this page is the
   * claim that nobody placed any of it.
   */
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 0xffffffff));
  const unicode = useCapabilities().unicode !== 'ascii';
  const art = unicode ? UNICODE : ASCII;
  

  const [who, setWho] = useState(0);
  const [hat, setHat] = useState(1);
  const [mood, setMood] = useState<Mood>('normal');

  useInput((event) => {
    if (event.name === 'r') { setSeed(seed + 1); return true; }
    if (event.name === 'p') { setWho(who + 1); return true; }
    if (event.name === 'h') { setHat(hat + 1); return true; }
    if (event.name === 'm') {
      setMood(MOODS[(MOODS.indexOf(mood) + 1) % MOODS.length] as Mood);
      return true;
    }
    return false;
  }, { global: true });

  return (
    <Column flex={1}>
      <Stage seed={seed} art={art} who={who} hat={hat} mood={mood} />
      <Row>
        <KeyHints
          flex={1}
          hints={[
            { keys: 'click', label: 'walk there' },
            { keys: 'arrows', label: 'step' },
            { keys: 'p', label: 'persona' },
            { keys: 'h', label: 'hat' },
            { keys: 'm', label: 'mood' },
            { keys: 'r', label: 'deal again' },
          ]}
        />
      </Row>
    </Column>
  );
});
