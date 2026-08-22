import { StatusBar, useStoreValue, defineComponent } from '@textui/core';
import type { RenderOutput, StatusSegment } from '@textui/core';
import type { Workspace } from '../workspace.js';
import { WORKSPACE_PATH } from '../workspace.js';
import { ACTIVE_PATH } from '../filesystem.js';
import { EDITOR_SELECTION } from '../tabs.js';

/**
 * The statusbar.
 *
 * What is true right now, not what you can do - the keys live in the hints
 * row. Segments are data so an extension can contribute one without this file
 * learning what git is.
 */
export const StatusLine: (props: Record<string, never>) => RenderOutput =
  defineComponent<Record<string, never>>('StatusLine', () => {
  const workspace = useStoreValue<Workspace>(WORKSPACE_PATH);
  const kind = useStoreValue<string>(`${ACTIVE_PATH}/kind`);
  const size = useStoreValue<number>(`${ACTIVE_PATH}/size`);
  const extra = useStoreValue<StatusSegment[]>('$/ui/status/segments', []);
  const mode = useStoreValue<string>('$/ui/editor/mode', 'view');
  const selection = useStoreValue<{ chars: number; lines: number }>(EDITOR_SELECTION);

  const leading: StatusSegment[] = [
    { id: 'root', label: workspace?.root ?? '' },
    ...(kind ? [{ id: 'kind', label: kind }] : []),
  ];

  // Only while editing: a count left over from the last file you had open is
  // a number about nothing.
  const selecting = mode === 'edit' && selection !== undefined && selection.chars > 0;

  const trailing: StatusSegment[] = [
    ...(selecting ? [{ id: 'selection', label: describe(selection) }] : []),
    ...(extra ?? []),
    ...(size !== undefined ? [{ id: 'size', label: formatSize(size) }] : []),
    { id: 'help', label: '? for keys' },
  ];

  return <StatusBar leading={leading} trailing={trailing} />;
});

/** What is selected, in the units a person counts it in. */
function describe(selection: { chars: number; lines: number }): string {
  const chars = `${selection.chars} selected`;
  return selection.lines > 1 ? `${chars} (${selection.lines} lines)` : chars;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
