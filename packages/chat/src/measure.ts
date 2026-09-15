import type { Rect } from '@textui/core';
import { useEffect, useMeasure, useRef } from '@textui/core';

/**
 * Tell whoever asked where this component is, and when it is gone.
 *
 * Reported on every change rather than once: a composer grows a slash menu
 * upward and grows again with a wrapped draft, and the block that asks about
 * a tool is only there while something is waiting. `null` on the way out, or
 * a screen that had one would keep making room for it after it had gone.
 *
 * The callback is read through a ref so an inline arrow - which is a new
 * function every render - does not re-run the unmount report every frame.
 */
export function useReportMeasure(onMeasure: ((rect: Rect | null) => void) | undefined): void {
  const rect = useMeasure();
  const latest = useRef(onMeasure);
  latest.current = onMeasure;
  useEffect(() => { latest.current?.(rect); }, [rect.x, rect.y, rect.width, rect.height]);
  useEffect(() => () => { latest.current?.(null); }, []);
}
