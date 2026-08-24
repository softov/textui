import type { TextProps } from '@textui/core';
import {
  defineComponent,
  h,
  stringWidth,
  useEffect,
  useMeasure,
  useRef,
  useRuntime,
  useState,
  useTicker,
} from '@textui/core';

export interface MarqueeProps extends TextProps {
  content: string;
  /**
   * Slide, or rest.
   *
   * Off is the resting state and the common one: a list of twenty rows is
   * twenty still labels, and the one under the cursor is the one that moves.
   * It is also what keeps the cost honest - a marquee that is not sliding
   * holds no ticker at all, so a menu is one animation and not one per row.
   */
  active?: boolean;
  /** Cells a second. */
  speed?: number;
  /** How long it waits at each end, in milliseconds. */
  dwell?: number;
  fps?: number;
}

/**
 * Text too long for its box, read by sliding it.
 *
 * The alternative was making something else give up room, and in a list there
 * is nothing else to take it from: a row is a label and a description and both
 * of them are the answer to "what is this". Truncating is fine for the rows you
 * are scanning past and useless for the one you have stopped on - which is
 * exactly the row a marquee costs anything for.
 *
 * Rests at the start, slides to the end, waits, and comes back. Not a loop
 * that wraps around: text that reappears from the right while its own tail is
 * still leaving reads as two strings rather than one long one.
 *
 * Nothing moves where animation is off - a pipe, a CI log, a reader who asked
 * for stillness - and there it is an ordinary truncated label.
 */
export const Marquee = defineComponent<MarqueeProps>('Marquee', (props) => {
  const { content, active = false, speed = 8, dwell = 900, fps = 10, ...rest } = props;
  const runtime = useRuntime();
  // What the last layout gave this text. Zero on the first pass, which is the
  // one where nothing is known and the honest answer is the whole string.
  const width = useMeasure().width;
  const travel = width > 0 ? Math.max(0, stringWidth(content) - width) : 0;
  const sliding = active && travel > 0 && !runtime.animation.disabled;

  // The ticker's own frame number, not a count of callbacks. A clock driven
  // by hand - a test, a static render - advances several frames in one call,
  // and a counter that adds one per call runs at whatever rate it was driven
  // at rather than at the rate it asked for.
  const [frame, setFrame] = useState(0);
  const seen = useRef(0);
  const from = useRef(0);
  useTicker((at) => { seen.current = at; setFrame(at - from.current); }, { fps, enabled: sliding });
  // Back to the start whenever it stops or the words change, so the row you
  // leave is the row you saw when you arrived at it.
  useEffect(() => { from.current = seen.current; setFrame(0); }, [sliding, content]);

  if (!sliding) return h('text', { content, truncate: 'end', ...rest });

  const perCell = Math.max(1, Math.round(fps / speed));
  const hold = Math.max(1, Math.round((dwell / 1000) * fps));
  const slide = travel * perCell;
  const cycle = hold + slide + hold + slide;
  const at = frame % cycle;
  const offset = at < hold
    ? 0
    : at < hold + slide
      ? Math.floor((at - hold) / perCell)
      : at < hold + slide + hold
        ? travel
        : travel - Math.floor((at - hold - slide - hold) / perCell);

  // Pinned to what it measured. Without this the sliced string is narrower
  // than the whole one, the layout hands the box back a different width, and
  // the next frame measures something new - a row that shivers.
  return h('text', { content: content.slice(offset, offset + width), width, ...rest });
});
