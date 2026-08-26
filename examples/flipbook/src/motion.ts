/**
 * The ASCII Motion document, as this example needs it.
 *
 * The file on disk is a sparse cell map: `animation.frames[].data` is keyed
 * `"x,y"` - column first - and any cell not listed is the canvas ground. Two
 * things about the format are easy to get wrong and both are load-bearing
 * here. The key is column-then-row, not row-then-column. And a frame carries
 * its own `duration`: this is a timeline of holds, not a frame rate, so a
 * seven-hundred millisecond glide and a sixty-seven millisecond flap sit next
 * to each other and a player that averages them destroys the animation.
 *
 * Parsing keeps the whole original object. Only `animation.frames` and
 * `canvas` are written back on save, so ids, palettes and any field a later
 * version of the format adds survive a round trip untouched.
 */

import type { Hex } from './palette.js';

export interface MotionCell {
  char?: string;
  color?: string;
  bgColor?: string;
}

export interface MotionDocument {
  id?: string;
  name?: string;
  description?: string;
  canvas_data?: MotionCanvasData;
  [key: string]: unknown;
}

export interface MotionCanvasData {
  name?: string;
  canvas?: { width?: number; height?: number; canvasBackgroundColor?: string; [k: string]: unknown };
  ui?: { fontMetrics?: { aspectRatio?: number; [k: string]: unknown }; [k: string]: unknown };
  palettes?: { recentColors?: string[]; [k: string]: unknown };
  animation?: { frames?: RawFrame[]; [k: string]: unknown };
  [key: string]: unknown;
}

interface RawFrame {
  id?: string;
  name?: string;
  duration?: number;
  data?: Record<string, MotionCell>;
}

export interface Cell {
  char: string;
  color: Hex;
}

export interface Frame {
  id: string;
  name: string;
  /** Milliseconds this frame is held. Never a frame rate. */
  duration: number;
  cells: Map<string, Cell>;
}

export interface Movie {
  name: string;
  width: number;
  height: number;
  ground: Hex;
  recent: Hex[];
  frames: Frame[];
  /** The document this came from, kept whole for saving. */
  source: MotionDocument;
}

export const key = (x: number, y: number): string => `${x},${y}`;

/** Split `"12,34"` without allocating an array per cell. */
export function unkey(k: string): { x: number; y: number } {
  const comma = k.indexOf(',');
  return { x: Number(k.slice(0, comma)), y: Number(k.slice(comma + 1)) };
}

export function parse(doc: MotionDocument): Movie {
  const cd: MotionCanvasData = doc.canvas_data ?? (doc as MotionCanvasData);
  const raw = cd.animation?.frames;
  if (!Array.isArray(raw)) {
    throw new Error('no animation.frames array - is this an ASCII Motion export?');
  }

  const frames: Frame[] = raw.map((f, i) => {
    const cells = new Map<string, Cell>();
    for (const [k, cell] of Object.entries(f.data ?? {})) {
      cells.set(k, { char: cell.char ?? ' ', color: (cell.color ?? '#000000') as Hex });
    }
    return {
      id: f.id ?? `frame-${i}`,
      name: f.name ?? `Frame ${i + 1}`,
      duration: Math.max(1, f.duration ?? 100),
      cells,
    };
  });

  return {
    name: doc.name ?? cd.name ?? 'untitled',
    width: cd.canvas?.width ?? 80,
    height: cd.canvas?.height ?? 45,
    ground: (cd.canvas?.canvasBackgroundColor ?? '#000000') as Hex,
    recent: (cd.palettes?.recentColors ?? []).filter((c) => /^#[0-9a-f]{6}$/i.test(c)) as Hex[],
    frames: frames.length > 0 ? frames : [{ id: 'frame-0', name: 'Frame 1', duration: 100, cells: new Map() }],
    source: doc,
  };
}

/** The union box of every printing cell, so a 80x45 canvas of birds is 42x6. */
export function contentBox(movie: Movie): { x: number; y: number; width: number; height: number } {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const frame of movie.frames) {
    for (const [k, cell] of frame.cells) {
      // A painted space is still blank - it is in the data but prints nothing.
      if (cell.char === ' ' || cell.char === '') continue;
      const { x, y } = unkey(k);
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
  }
  if (x0 === Infinity) return { x: 0, y: 0, width: movie.width, height: movie.height };
  return { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

/** Every colour that actually prints, most used first. */
export function usedColors(movie: Movie): { color: Hex; count: number }[] {
  const tally = new Map<Hex, number>();
  for (const frame of movie.frames) {
    for (const cell of frame.cells.values()) {
      if (!cell.char || cell.char === ' ') continue;
      tally.set(cell.color, (tally.get(cell.color) ?? 0) + 1);
    }
  }
  return [...tally].map(([color, count]) => ({ color, count })).sort((a, b) => b.count - a.count);
}

export const totalMs = (movie: Movie): number =>
  movie.frames.reduce((sum, f) => sum + f.duration, 0);

/** The document again, with this movie's frames written into it. */
export function serialise(movie: Movie): string {
  const doc = movie.source;
  const cd: MotionCanvasData = doc.canvas_data ?? (doc as MotionCanvasData);
  cd.canvas = { ...(cd.canvas ?? {}), width: movie.width, height: movie.height, canvasBackgroundColor: movie.ground };
  cd.animation = {
    ...(cd.animation ?? {}),
    frames: movie.frames.map((f) => {
      const data: Record<string, MotionCell> = {};
      for (const [k, cell] of f.cells) {
        data[k] = { char: cell.char, color: cell.color, bgColor: 'transparent' };
      }
      return { id: f.id, data, name: f.name, duration: f.duration };
    }),
  };
  return JSON.stringify(doc, null, 2);
}
