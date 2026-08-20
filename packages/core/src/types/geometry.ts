/** Terminal geometry is integral cells. Never fractional. */
export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** padding / margin / border widths, in cells. */
export interface Edges {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export type EdgeSpec =
  | number
  | [vertical: number, horizontal: number]
  | [top: number, horizontal: number, bottom: number]
  | [top: number, right: number, bottom: number, left: number]
  | Partial<Edges>;

export const ZERO_EDGES: Edges = { top: 0, right: 0, bottom: 0, left: 0 };

export function rectContains(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height;
}

export function rectIntersect(a: Rect, b: Rect): Rect {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  return { x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) };
}

export function rectEquals(a: Rect, b: Rect): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}
