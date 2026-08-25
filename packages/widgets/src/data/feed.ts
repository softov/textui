import type { BoxProps } from '@textui/core';
import {
  chorded,
  defineComponent,
  h,
  useFocus,
  useInput,
  useMeasure,
  useRef,
  useScrollExtent,
  useState,
} from '@textui/core';
import { sizedByLayout } from '../viewport.js';
import { FeedEntry, FeedScrollbar } from './shared.js';

// ---------------------------------------------------------------------- feed

export interface FeedProps extends BoxProps {
  /** The entries. Any height each - that is the whole point of this one. */
  children?: unknown;
  /**
   * Stick to the newest entry. Turned off when the reader scrolls up, and back
   * on at the bottom - a feed that yanks itself away is one you cannot read.
   */
  follow?: boolean;
  onFollowChange?(follow: boolean): void;
  /**
   * The cursor, by index. Passed, the caller owns it; omitted, the arrows
   * scroll by line instead, which is what a feed with nothing to activate
   * wants.
   */
  selectedIndex?: number;
  onSelect?(index: number): void;
  onActivate?(index: number): void;
  scrollbar?: boolean;
  /**
   * Who `pageup` and `pagedown` belong to.
   *
   * `focused` is the ordinary answer: the keys go to whatever has the
   * keyboard. `always` claims them even while something else does - for the
   * feed that *is* the screen, with a text field under it. Somebody typing a
   * message who presses page up means the conversation above them; there is
   * nothing else on that screen those keys could be for, and taking the
   * keyboard away from the field to use them is the thing they are avoiding.
   *
   * Only those two keys, and only when the focused node has declined them
   * first - so a field that pages its own content keeps them.
   */
  pageKeys?: 'focused' | 'always';
  focusable?: boolean;
  autoFocus?: boolean;
  /** So a command can send the reader here by name. */
  focusId?: string;
}

/**
 * A viewport over entries of any height.
 *
 * The one between `List` and `ScrollView`, and it is not either of them:
 * `List` is fixed-height rows with a selection, `ScrollView` is a dumb
 * viewport, and a feed is entries whose height is whatever their text wrapped
 * to, with a cursor that moves between them and a tail it follows.
 *
 * Heights are **measured, not computed**. What a paragraph wraps to is decided
 * by the layout, so each entry reports its height after it is laid out and the
 * feed scrolls by summing them. That is one frame behind, which is invisible,
 * and it is the only answer that is not a guess.
 *
 * A transcript, an activity stream, search results with snippets, a diff whose
 * files expand - all the same component, because all of them are "an ordered
 * list of things that are not one line tall".
 */
export const Feed = defineComponent<FeedProps>('Feed', (props) => {
  const {
    children, follow: followProp, onFollowChange, selectedIndex, onSelect, onActivate,
    pageKeys = 'focused',
    scrollbar = true, focusable = true, autoFocus, focusId, id, ...rest
  } = props;

  const focus = useFocus({
    ...(focusId ? { id: focusId } : {}),
    disabled: !focusable,
    ...(autoFocus ? { autoFocus } : {}),
  });
  const measured = useMeasure();
  const extent = useScrollExtent();
  const heights = useRef<number[]>([]);

  // The catalog's rule, and this has to follow it like every other viewport:
  // given `flex`, a `height`, a `maxHeight` or a `basis`, the layout decided
  // the size and the feed fills it and scrolls; given none of those, the
  // content decides and it draws everything. Clamping to a measurement in the
  // second case is clamping to how tall it happened to be last frame, which
  // for a box that is sized *by* this content is nothing at all - the entries
  // vanish and the panel is empty.
  const fills = sizedByLayout(props) && measured.height > 0;

  // Null is "at the tail", rather than a boolean beside a number: the two can
  // disagree, and a follow flag that says yes while the offset says otherwise
  // is how a log ends up frozen three lines from the bottom.
  const [internalTop, setInternalTop] = useState<number | null>(null);
  const [internalIndex, setInternalIndex] = useState(0);

  const entries = (Array.isArray(children) ? children : [children]).filter((c) => c != null);
  const count = entries.length;
  const selects = onSelect !== undefined || selectedIndex !== undefined;
  const index = Math.max(0, Math.min(count - 1, selectedIndex ?? internalIndex));

  const total = extent?.height ?? 0;
  const limit = Math.max(0, total - measured.height);
  const following = followProp ?? (internalTop === null);
  const top = following ? limit : Math.min(internalTop ?? 0, limit);

  const scrollTo = (next: number | null): void => {
    if (next === null) {
      setInternalTop(null);
      onFollowChange?.(true);
      return;
    }
    const clamped = Math.max(0, Math.min(next, limit));
    setInternalTop(clamped);
    // Scrolled back to the bottom is following again, without a second key.
    onFollowChange?.(clamped >= limit);
  };

  /** Where an entry starts, from what the layout measured last frame. */
  const startOf = (target: number): number => {
    let y = 0;
    for (let i = 0; i < target && i < heights.current.length; i++) y += (heights.current[i] ?? 1);
    return y;
  };

  const reveal = (target: number): void => {
    const start = startOf(target);
    const height = heights.current[target] ?? 1;
    const view = Math.max(1, measured.height);
    if (start < top) scrollTo(start);
    else if (start + height > top + view) scrollTo(start + height - view);
    else scrollTo(top);
  };

  const move = (delta: number): void => {
    if (count === 0) return;
    const next = Math.max(0, Math.min(count - 1, index + delta));
    if (selectedIndex === undefined) setInternalIndex(next);
    onSelect?.(next);
    reveal(next);
  };

  useInput(
    (event) => {
      const page = Math.max(1, measured.height - 2);
      if (chorded(event)) return false;
      switch (event.name) {
        case 'up': case 'k':
          if (selects) move(-1); else scrollTo(top - 1);
          return true;
        case 'down': case 'j':
          if (selects) move(1); else scrollTo(top + 1);
          return true;
        case 'pageup': scrollTo(top - page); return true;
        case 'pagedown': scrollTo(top + page); return true;
        case 'home': case 'g':
          scrollTo(0);
          if (selects) { if (selectedIndex === undefined) setInternalIndex(0); onSelect?.(0); }
          return true;
        case 'end': case 'G':
          scrollTo(null);
          if (selects && count > 0) {
            if (selectedIndex === undefined) setInternalIndex(count - 1);
            onSelect?.(count - 1);
          }
          return true;
        case 'f': scrollTo(following ? top : null); return true;
        case 'enter': case 'space':
          if (onActivate && count > 0) { onActivate(index); return true; }
          return false;
        default: return false;
      }
    },
    { focusId: focus.id, enabled: focusable },
  );

  /*
   * The page keys, from wherever the keyboard happens to be.
   *
   * `global` handlers run only after the focused node has declined the key,
   * so a field that pages its own content still keeps them - this is the one
   * that catches what nothing else wanted.
   */
  useInput(
    (event) => {
      if (event.name !== 'pageup' && event.name !== 'pagedown') return false;
      if (chorded(event)) return false;
      const page = Math.max(1, measured.height - 2);
      scrollTo(event.name === 'pageup' ? top - page : top + page);
      return true;
    },
    { global: true, enabled: pageKeys === 'always' },
  );

  const drawn = entries.map((entry, i) => h(FeedEntry, {
    key: i,
    onHeight: (height: number) => { heights.current[i] = height; },
  }, entry));

  // Content-sized: draw everything and let the box grow. Clamping to a
  // measurement here would clamp to how tall this happened to be last frame,
  // which for a box sized *by* its own content is nothing at all - the entries
  // vanish and the panel is empty.
  if (!fills) {
    return h('box', {
      id: id ?? focus.id,
      role: 'list',
      ...rest,
      direction: 'column',
    }, ...drawn);
  }

  return h('box', {
    id: id ?? focus.id,
    role: 'list',
    ...rest,
    direction: 'row',
    overflow: 'hidden',
    onMouse: (event: { action: string; wheel?: number }) => {
      if (event.action !== 'wheel') return false;
      scrollTo(top + (event.wheel ?? 0) * 3);
      return true;
    },
  },
    h('box', { flex: 1, direction: 'column', scrollTop: top, overflow: 'scroll' }, ...drawn),
    // Only when there is somewhere to scroll. A track down the side of a feed
    // that fits is chrome that states something untrue.
    scrollbar && limit > 0 ? h(FeedScrollbar, {}) : null,
  );
});
