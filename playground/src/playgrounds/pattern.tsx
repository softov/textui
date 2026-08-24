import { useState, useStoreValue } from '@textui/core';
import { Button, Column, Divider, Heading, KeyHints, Label, Row, Tabs } from '@textui/widgets';
import { Pattern } from '../components/pattern.js';
import { TILE_PATH, type TileSource } from '../tile.js';

/**
 * Pattern.
 *
 * One page per rule, because the rules are about *how much* gets drawn and two
 * of them side by side in a small box look the same. A page each, at the size
 * of the window, is the only way the difference between "once", "three times"
 * and "as many as fit" is actually visible.
 *
 * Each page prints the props it was given, generated from the same object the
 * pattern is rendered with - so the caption cannot drift from the thing above
 * it, which is the usual way a playground starts lying.
 *
 * `pnpm dev pattern --tile some.txt` puts your own tile under all nine rules
 * without touching any of this, which is the only way to find out whether a
 * tile you drew survives being repeated.
 */

/** Each tile with the substitute an ascii terminal gets instead. */
const CHECKS = { tile: ['▘▗', '▝▖'], ascii: ['#.', '.#'] };
const HATCH = { tile: ['╱ ', ' ╱'], ascii: ['/ ', ' /'] };
const SCANLINE = { tile: ['  ', '──'], ascii: ['  ', '--'] };

type Tile = typeof CHECKS;

interface Page {
  id: string;
  label: string;
  note: string;
  tile: Tile;
  props: Record<string, unknown>;
  /** Draw the sample content inside the pattern, for the layering pages. */
  content?: boolean;
}

const PAGES: Page[] = [
  {
    id: 'once',
    label: 'Once',
    note: 'Neither axis set, so the tile is drawn once. `x={0} y={0}` means the same thing - not repeating and repeating zero times are the same request.',
    tile: CHECKS,
    props: {},
  },
  {
    id: 'across',
    label: 'Across',
    note: '-1 repeats until the box runs out. Only x is set, so it fills sideways and stays one tile deep.',
    tile: CHECKS,
    props: { x: -1 },
  },
  {
    id: 'down',
    label: 'Down',
    note: 'The same rule on the other axis. One tile wide, as deep as the box.',
    tile: CHECKS,
    props: { y: -1 },
  },
  {
    id: 'fill',
    label: 'Fill',
    note: 'Both axes at -1: the tile covers the box, and follows it when the terminal is resized.',
    tile: CHECKS,
    props: { x: -1, y: -1 },
  },
  {
    id: 'count',
    label: 'Count',
    note: 'A positive number draws exactly that many copies, wherever the box ends.',
    tile: CHECKS,
    props: { x: 6, y: 3 },
  },
  {
    id: 'clip',
    label: 'Clip',
    note: 'More copies than there is room for. The box clips them - a count is a maximum, never a reason to overflow.',
    tile: CHECKS,
    props: { x: 99, y: 99 },
  },
  {
    id: 'limit',
    label: 'Limit',
    note: 'limit stops the fill short of the box, in cells. Whichever runs out first wins, so this is a fill that stays small when the window grows.',
    tile: CHECKS,
    props: { x: -1, y: -1, limit: { width: 24, height: 6 } },
  },
  {
    id: 'under',
    label: 'Under',
    note: 'asBackground draws the tile before the children, so they sit on top of it. A terminal has no z-buffer, only paint order - so anything without a background of its own lets the tile through, which is why the hatch runs inside the buttons\' frames as well as around them.',
    tile: HATCH,
    props: { x: -1, y: -1, asBackground: true },
    content: true,
  },
  {
    id: 'over',
    label: 'Over',
    note: 'asOverlay draws the tile after the children instead, so it crosses them. Same tree, same content, opposite result.',
    tile: SCANLINE,
    props: { x: -1, y: -1, asOverlay: true },
    content: true,
  },
];

/**
 * The props, as they were written.
 *
 * Generated from the object the pattern is actually rendered with, so the two
 * cannot disagree.
 */
function propsLine(props: Record<string, unknown>): string {
  // JSON quotes every key, which reads as data rather than as the JSX this is
  // meant to be a copy of.
  const value = (v: unknown): string =>
    v !== null && typeof v === 'object'
      ? `{ ${Object.entries(v).map(([k, inner]) => `${k}: ${value(inner)}`).join(', ')} }`
      : String(v);

  const parts = Object.entries(props).map(([key, v]) => (v === true ? key : `${key}={${value(v)}}`));
  return ['<Pattern tile={…}', ...parts, '/>'].join(' ');
}

/** What the layering pages put inside the pattern. */
function SampleContent() {
  return (
    <Column gap={1} flex={1}>
      <text content="Content sharing the box with the pattern." bold />
      <Row gap={1}>
        <Button label="Still focusable" onPress={() => {}} />
        <Button label="And still pressable" onPress={() => {}} />
      </Row>
    </Column>
  );
}

export function PatternPlayground() {
  const [id, setId] = useState('once');
  const page = PAGES.find((p) => p.id === id) ?? (PAGES[0] as Page);

  // A tile handed in on the command line replaces the one every page would
  // have drawn, so a tile of your own can be seen under all nine rules rather
  // than only the one whose glyphs happen to suit it.
  const supplied = useStoreValue<TileSource>(TILE_PATH);
  const tile = supplied ? { tile: supplied.rows, ascii: supplied.ascii } : page.tile;

  return (
    <Column flex={1} gap={1} padding={1}>
      <Row gap={1}>
        <Heading content="Pattern" />
        <Label content={supplied ? `tiled from ${supplied.source}` : 'a tile, repeated'} />
      </Row>

      {/*
        Focus starts here, so the keyboard has somewhere to be on arrival and
        left/right walk the pages without anyone having to guess at tab first.
      */}
      <Tabs items={PAGES.map(({ id: pageId, label }) => ({ id: pageId, label }))}
        activeId={id} onChange={setId} autoFocus />
      <Divider />

      <text content={page.note} fg="muted" wrap="word" />
      <text content={propsLine(page.props)} fg="accent" />

      <box flex={1} border={{ style: 'single', color: 'borderSubtle' }} padding={1}>
        <Pattern
          {...tile}
          {...page.props}
          transparent=" "
          fg={page.content === true ? 'borderSubtle' : 'accent'}
          flex={1}
        >
          {page.content === true ? <SampleContent /> : null}
        </Pattern>
      </box>

      <KeyHints
        hints={[
          { keys: 'left/right', label: 'page' },
          { keys: 'tab', label: 'move' },
        ]}
      />
    </Column>
  );
}
