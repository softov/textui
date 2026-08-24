import type { BoxProps, RenderOutput, SemanticVariant } from '@textui/core';
import { defineComponent, useMemo } from '@textui/core';
import { Column } from '@textui/widgets';

/**
 * A small drawn thing, above the invitation to say something.
 *
 * An empty screen is the one place a client can afford a figure, and a
 * different one each time is the difference between an application that has a
 * mascot and one that has a habit. Six of them, three moods each.
 *
 * Two rules, and both of them came from watching art break in a terminal:
 *
 * Plain ASCII, every character. Not one glyph here is one whose width the
 * terminal gets to decide - box drawing and the half-block set are the ones
 * that get eaten by a CJK font setting, and art that is one cell wider on
 * somebody else's machine does not look narrow, it looks broken.
 *
 * No shared frame, no shared face window, no shared size. These run from seven
 * cells wide to sixteen and from three rows to five, and the outline *is* the
 * animal. A creature that fits a template is a template wearing a hat.
 *
 * Adapted from `doop`'s glyph sampler, which is where they were drawn.
 */

export const MOODS = ['happy', 'thinking', 'angry'] as const;
export type Mood = typeof MOODS[number];

/**
 * `String.raw`, because this is drawing.
 *
 * A figure whose every backslash has to be doubled to survive the parser is
 * one somebody will eventually get wrong, and the mistake does not look like a
 * mistake - it looks like a slightly worse cat.
 */
const raw = (text: string): string[] => text.split('\n')
  .filter((line, i, all) => !(line.trim() === '' && (i === 0 || i === all.length - 1)));

interface Drawing {
  name: string;
  happy: string[];
  thinking: string[];
  angry: string[];
  /** Filled at load, from the rows themselves. Nothing here is counted by hand. */
  width: number;
}

const DRAWINGS: Drawing[] = [
  {
    name: 'cat',
    happy: raw(String.raw`
 /\_/\
( ^.^ )
 > ^ <
(_____)~
`),
    thinking: raw(String.raw`
 /\_/\  o
( -.o )
 > - <
(_____)~
`),
    angry: raw(String.raw`
 /\_/\
( >.< )
 >WWW<
(_____)/
`),
    width: 0,
  },
  {
    name: 'bunny',
    happy: raw(String.raw`
  (\_/)
  ( ^.^)
 c(")_(")
`),
    thinking: raw(String.raw`
  (\_/)  o
  ( o.-)
 c(")_(")
`),
    angry: raw(String.raw`
  (\_/)
  ( >.<)
 c(")_(")
`),
    width: 0,
  },
  {
    name: 'crab',
    happy: raw(String.raw`
 (\)_       _(/)
   \\_______//
   (  ^   ^  )
    \_|_|_|_/
   /\       /\
`),
    thinking: raw(String.raw`
 (\)_       _(/)
   \\_______//  o
   (  o   -  )
    \_|_|_|_/
   /\       /\
`),
    angry: raw(String.raw`
 (\/)       (\/)
  \\_________//
   (  >   <  )
    \_|_|_|_/
   /\       /\
`),
    width: 0,
  },
  {
    name: 'owl',
    happy: raw(String.raw`
 ,___,
 (^,^)
 /)_)
  " "
`),
    thinking: raw(String.raw`
 ,___,  o
 (o,o)
 /)_)
  " "
`),
    angry: raw(String.raw`
  ,___,
 /(>,<)\
/)_____(\
    v v
`),
    width: 0,
  },
  {
    name: 'beetle',
    happy: raw(String.raw`
   \   /
  __\_/__
 /( ^.^ )\
 \|=====|/
  /  |  \
`),
    thinking: raw(String.raw`
   \  /    o
  __\_/__
 /( o.- )\
 \|=====|/
  /  |  \
`),
    angry: raw(String.raw`
  \     /
  _\___/_
 /( >.< )\
 \|=====|/
  /  |  \
`),
    width: 0,
  },
  {
    name: 'sprout',
    happy: raw(String.raw`
   \|/
   _|_
  (^ ^)
  (\_/)
   |||
`),
    thinking: raw(String.raw`
   \|/  o
   _|_
  (o -)
  ( - )
   |||
`),
    angry: raw(String.raw`
   /|\
   _|_
  (> <)
  (/W\)
   |||
`),
    width: 0,
  },
];

// Padded to each figure's own widest row, once, at load - so a creature has
// one width whatever mood it is in, and nothing under it moves when the mood
// changes.
for (const drawing of DRAWINGS) {
  drawing.width = Math.max(...MOODS.flatMap((mood) => drawing[mood].map((row) => row.length)));
  for (const mood of MOODS) {
    drawing[mood] = drawing[mood].map((row) => row.padEnd(drawing.width));
  }
}

export const CREATURES: readonly string[] = DRAWINGS.map((drawing) => drawing.name);

/** How tall the tallest of them is, for anyone deciding whether there is room. */
export const CREATURE_HEIGHT = Math.max(
  ...DRAWINGS.flatMap((drawing) => MOODS.map((mood) => drawing[mood].length)),
);

/**
 * A mood per tone, rather than a colour per creature.
 *
 * Which creature you got says nothing; what it is doing is the thing worth
 * reading from across the room. Semantic names, so a theme decides the colour
 * and the figure is legible on paper as well as on a dark terminal.
 */
const TONE: Record<Mood, SemanticVariant> = {
  happy: 'success',
  thinking: 'accent',
  angry: 'danger',
};

export function drawCreature(name: string, mood: Mood = 'happy'): string[] {
  const drawing = DRAWINGS.find((found) => found.name === name) ?? DRAWINGS[0] as Drawing;
  return drawing[mood];
}

export interface CreatureProps extends BoxProps {
  /** Which one. Left out, one is picked at random and kept for this mount. */
  name?: string;
  mood?: Mood;
  /** Override the mood's own tone. */
  tone?: SemanticVariant;
}

export const Creature: (props: CreatureProps) => RenderOutput =
  defineComponent<CreatureProps>('Creature', (props) => {
    const { name, mood = 'happy', tone, ...rest } = props;

    // Picked once and kept: a figure that changed on every keystroke would be
    // a flicker rather than a mascot. `useMemo` with no deps is the mount.
    const chosen = useMemo(
      () => name ?? CREATURES[Math.floor(Math.random() * CREATURES.length)] as string,
      [name],
    );

    // No `unicode` check, which is the point of the alphabet: there is no
    // ASCII fallback to swap in because there is nothing here to fall back
    // from. The figure that renders on a terminal that can draw anything is
    // the same figure that renders on one that can draw nothing.
    return (
      <Column align="center" {...rest}>
        {drawCreature(chosen, mood).map((row, at) => (
          <text key={`${chosen}-${at}`} content={row} fg={tone ?? TONE[mood]} />
        ))}
      </Column>
    );
  });
