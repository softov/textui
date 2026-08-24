import type { BoxProps, SemanticVariant } from '@textui/core';
import {
  chorded,
  defineComponent,
  h,
  useFocus,
  useInput,
  useMeasure,
  useState,
} from '@textui/core';
import { TONE } from '../tone.js';
import { viewportRows } from '../viewport.js';

export interface LogLine {
  time?: string;
  level?: 'debug' | 'info' | 'warn' | 'error';
  source?: string;
  message: string;
}

export interface LogViewerProps extends BoxProps {
  lines: LogLine[];
  /** Rows shown. Older lines scroll off the top. */
  visibleRows?: number;
  /** Stick to the newest line. Turned off when the reader scrolls up. */
  follow?: boolean;
  showTime?: boolean;
  showLevel?: boolean;
  onFollowChange?(follow: boolean): void;
}

const LEVEL_TONE: Record<string, SemanticVariant> = {
  debug: 'muted', info: 'info', warn: 'warning', error: 'danger',
};

/**
 * Streaming text.
 *
 * A log viewer follows the tail until the reader scrolls, then stops - the one
 * behaviour that makes the difference between a log you can read and a log
 * that yanks itself out from under you.
 */
export const LogViewer = defineComponent<LogViewerProps>('LogViewer', (props) => {
  const {
    lines, visibleRows: visibleRowsProp, follow: followProp, showTime = true,
    showLevel = true, onFollowChange, ...rest
  } = props;

  const focus = useFocus({});
  const measured = useMeasure();
  const [offset, setOffset] = useState(0);
  const [following, setFollowing] = useState(followProp ?? true);
  const follow = followProp ?? following;

  // Ten rows was a guess. The pane knows the answer.
  const visibleRows = viewportRows(props, measured, visibleRowsProp ?? 10, {
    requested: visibleRowsProp,
  });
  const maxOffset = Math.max(0, lines.length - visibleRows);
  const top = follow ? maxOffset : Math.min(offset, maxOffset);

  const scroll = (delta: number): void => {
    const next = Math.max(0, Math.min(maxOffset, top + delta));
    setOffset(next);
    const nowFollowing = next >= maxOffset;
    if (followProp === undefined) setFollowing(nowFollowing);
    onFollowChange?.(nowFollowing);
  };

  useInput(
    (event) => {
      if (chorded(event)) return false;
      switch (event.name) {
        case 'up': scroll(-1); return true;
        case 'down': scroll(1); return true;
        case 'pageup': scroll(-visibleRows); return true;
        case 'pagedown': scroll(visibleRows); return true;
        case 'home': scroll(-lines.length); return true;
        case 'end': scroll(lines.length); return true;
        default: return false;
      }
    },
    { focusId: focus.id },
  );

  const window = lines.slice(top, top + visibleRows);

  return h('box', { id: focus.id, role: 'log', direction: 'column', ...rest },
    ...window.map((line, i) =>
      h('box', { key: top + i, direction: 'row', gap: 1 },
        showTime && line.time ? h('text', { content: line.time, fg: 'subtle' }) : null,
        showLevel && line.level
          ? h('text', {
              content: line.level.toUpperCase().padEnd(5),
              fg: TONE[LEVEL_TONE[line.level] ?? 'muted'],
            })
          : null,
        line.source ? h('text', { content: line.source, fg: 'muted' }) : null,
        h('text', { content: line.message, flex: 1, truncate: 'end' }),
      )),
    !follow
      ? h('text', { content: '  paused - end to follow', fg: 'warning', dim: true })
      : null,
  );
});
