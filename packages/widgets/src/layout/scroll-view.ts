import type { BoxProps } from '@textui/core';
import {
  chorded,
  defineComponent,
  h,
  useFocus,
  useInput,
  useMeasure,
  useScrollExtent,
  useState,
} from '@textui/core';
import { ScrollThumb } from '../data/scroll-thumb.js';

export interface ScrollViewProps extends BoxProps {
  /** Controlled offset. Omit to let the view manage its own. */
  offset?: number;
  onScroll?(offset: number): void;
  /** Draw a scrollbar on the right when the content overflows. */
  scrollbar?: boolean;
  /**
   * A tab stop, so the keys that scroll it can reach it.
   *
   * On by default: a viewport had the arrow handlers all along and registered
   * nothing, so unless the caller happened to make it focusable itself the
   * only way to scroll was the wheel - which is to say, on a keyboard, not at
   * all. Turn it off for a view that scrolls inside something already focused.
   */
  focusable?: boolean;
  autoFocus?: boolean;
}

/**
 * A scrolling viewport.
 *
 * Scroll position is a number of cells, not a fraction: a terminal cannot
 * scroll by half a line, and pretending otherwise makes a list jitter as it
 * rounds.
 */
export const ScrollView = defineComponent<ScrollViewProps>('ScrollView', (props) => {
  const {
    offset, onScroll, scrollbar = true, focusable = true, autoFocus, id,
    children, ...rest
  } = props;
  const focus = useFocus({ disabled: !focusable, autoFocus });
  const [internal, setInternal] = useState(0);
  const top = offset ?? internal;
  // How far down this can go before the last line leaves the bottom. Written
  // by the viewport during its render, read here when a key arrives - so a
  // limit that changed with the terminal's height needs no round trip.
  const measured = useMeasure();
  const extent = useScrollExtent();
  // How far the top can go before the last line leaves the bottom of the view.
  // Zero when everything fits, which is also what makes the arrows do nothing
  // in a viewport that has nothing to scroll.
  const limit = Math.max(0, (extent?.height ?? 0) - measured.height);

  const scrollTo = (next: number): void => {
    const clamped = Math.max(0, Math.min(next, limit));
    if (offset === undefined) setInternal(clamped);
    onScroll?.(clamped);
  };

  useInput(
    (event) => {
      if (chorded(event)) return false;
      if (event.name === 'up') { scrollTo(top - 1); return true; }
      if (event.name === 'down') { scrollTo(top + 1); return true; }
      if (event.name === 'pageup') { scrollTo(top - 10); return true; }
      if (event.name === 'pagedown') { scrollTo(top + 10); return true; }
      if (event.name === 'home') { scrollTo(0); return true; }
      return false;
    },
    { focusId: focus.id, enabled: focusable },
  );

  // The outer box holds the viewport beside the scrollbar and does not scroll
  // itself. It used to say `overflow: 'scroll'` with a `scrollTop`, on a row -
  // where the scrolling axis is horizontal, so the offset did nothing and the
  // only real effect was to stop the viewport being clamped to the width it
  // had. That made the row report *its own* sideways overflow as this view's
  // scroll extent: a number about a different box on a different axis.
  return h('box', {
    id: id ?? focus.id,
    role: 'region',
    ...rest,
    overflow: 'hidden',
    direction: 'row',
    onMouse: (event: { action: string; wheel?: number }) => {
      if (event.action !== 'wheel') return false;
      scrollTo(top + (event.wheel ?? 0) * 3);
      return true;
    },
  },
    h('box', { flex: 1, direction: 'column', scrollTop: Math.min(top, limit), overflow: 'scroll' }, children),
    // `ScrollThumb`, which is what every other viewport in the library draws -
    // its own comment says so: "two components drawing their own would drift".
    // This one drew a different thing, a one-cell column filled with a border
    // glyph, that took the offset as a prop and ignored it. So it said nothing
    // about where you were or how much there was, and against a bordered child
    // it was indistinguishable from another border. A scrollbar that cannot be
    // told from a frame is not a scrollbar.
    //
    // And only when there is something to scroll. `limit` is zero when it all
    // fits, which is exactly when a bar is a lie - the prop has always been
    // documented that way and was drawn unconditionally.
    scrollbar && limit > 0
      ? h(ScrollThumb, {
          total: extent?.height ?? measured.height,
          rows: measured.height,
          offset: Math.min(top, limit),
          focused: focus.focused,
        })
      : null,
  );
});
