import { StatusBar, useStoreValue, defineComponent } from '@textui/core';
import type { RenderOutput, StatusSegment } from '@textui/core';
import type { Workspace } from '../workspace.js';
import { WORKSPACE_PATH } from '../workspace.js';
import { ACTIVE_PATH } from '../filesystem.js';

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

  const leading: StatusSegment[] = [
    { id: 'root', label: workspace?.root ?? '' },
    ...(kind ? [{ id: 'kind', label: kind }] : []),
  ];

  const trailing: StatusSegment[] = [
    ...(extra ?? []),
    ...(size !== undefined ? [{ id: 'size', label: formatSize(size) }] : []),
    { id: 'help', label: '? for keys' },
  ];

  return <StatusBar leading={leading} trailing={trailing} />;
});

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
