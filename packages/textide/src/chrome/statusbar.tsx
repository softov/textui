import { PANEL_PATH, StatusBar, panelStatusPath, useStoreValue, defineComponent } from '@textui/core';
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
  /*
   * Whatever the panel the keyboard is in has to say.
   *
   * The bar used to read a selection count the editor was wired to publish,
   * which meant the one renderer that had been thought of got a status line
   * and no other could. A panel publishes for whatever is inside it, so a
   * diff saying which hunk, or a search saying how many are left, arrives
   * here without this file learning about either.
   */
  const panel = useStoreValue<string | null>(PANEL_PATH, null);
  const status = useStoreValue<string | null>(panelStatusPath(panel ?? 'none'), null);

  const leading: StatusSegment[] = [
    { id: 'root', label: workspace?.root ?? '' },
    ...(kind ? [{ id: 'kind', label: kind }] : []),
  ];

  const trailing: StatusSegment[] = [
    ...(panel !== null && status ? [{ id: 'panel', label: status }] : []),
    ...(extra ?? []),
    ...(size !== undefined ? [{ id: 'size', label: formatSize(size) }] : []),
    { id: 'help', label: 'f1 for keys' },
  ];

  return <StatusBar leading={leading} trailing={trailing} />;
});

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
