import type { RenderOutput } from '@textui/core';
import { defineComponent, useInterval, useState, useStoreValue } from '@textui/core';
import type { StatusSegment } from '@textui/widgets';
import { StatusBar } from '@textui/widgets';
import type { Workspace } from '../workspace.js';
import { WORKSPACE_PATH } from '../workspace.js';

/**
 * The statusbar.
 *
 * Where you are, and nothing that belongs to something narrower. It used to
 * carry four different scopes at once - the workspace, the file the *explorer*
 * had selected, whatever the focused panel wanted to say, and a key hint - so
 * reading it meant first working out which of them each part was about.
 *
 * Each of those now has a place that owns it. The panel line is under the pane
 * it describes, published by the renderer through `usePanelStatus`. The
 * selected file's kind and size are in the explorer's own footer, beside the
 * tree that selected it. What is left here is what is true of the whole
 * window: which folder, which branch, and the time.
 *
 * `f1` stays. It is the way to every key that is not written on the screen,
 * and a discoverable route to the shortcut sheet is worth one segment - the
 * rest of the row is empty space anyway.
 *
 * Segments are data so an extension can contribute one without this file
 * learning what git is: the branch is git's, arriving through
 * `$/ui/status/segments`, and it sits beside the folder because "which folder,
 * which branch" is one thought.
 */
export const StatusLine: (props: Record<string, never>) => RenderOutput =
  defineComponent<Record<string, never>>('StatusLine', () => {
  const workspace = useStoreValue<Workspace>(WORKSPACE_PATH);
  const extra = useStoreValue<StatusSegment[]>('$/ui/status/segments', []);

  const leading: StatusSegment[] = [
    { id: 'root', label: workspace?.root ?? '' },
    ...(extra ?? []),
  ];

  const trailing: StatusSegment[] = [
    { id: 'help', label: 'f1 for keys' },
    { id: 'clock', label: useClock() },
  ];

  return <StatusBar leading={leading} trailing={trailing} />;
});

/**
 * The time, to the minute.
 *
 * Ticked every fifteen seconds rather than every second: the display has no
 * seconds in it, so a per-second timer would redraw the whole bar sixty times
 * for fifty-nine frames that look identical. Fifteen is close enough that the
 * minute is never visibly stale and cheap enough to leave running.
 *
 * Local time and 24-hour, from the runtime's own formatter, so a session in
 * another locale gets that locale's separator rather than a hardcoded colon.
 */
function useClock(): string {
  const [now, setNow] = useState(() => stamp());
  useInterval(() => { setNow(stamp()); }, 15_000);
  return now;
}

function stamp(): string {
  return new Date().toLocaleTimeString(undefined, {
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}
