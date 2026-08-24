import type { RenderOutput } from '@textui/core';
import {
  useRuntime,
  useStoreSubtree,
  useStoreValue,
  useTheme,
  defineComponent,
} from '@textui/core';
import { Row } from '@textui/widgets';
import { DOCUMENTS_ROOT, isDocumentDirty } from '@textui/documents';
import type { Workspace } from '../workspace.js';
import { WORKSPACE_PATH } from '../workspace.js';
import { EDITOR_URI, tabLabel } from '../tabs.js';
import { MenuBar } from './menubar.js';

/**
 * The titlebar.
 *
 * The menus, then three facts in the order they are asked for: which
 * workspace, which file, and whether that file has unsaved changes. The dirty
 * marker is a glyph as well as a colour, because a 16-colour session and a
 * screenshot both lose the colour and neither loses the dot.
 */
export const TitleBar: (props: Record<string, never>) => RenderOutput =
  defineComponent<Record<string, never>>('TitleBar', () => {
    const theme = useTheme();
    const runtime = useRuntime();
    const workspace = useStoreValue<Workspace>(WORKSPACE_PATH);
    /*
     * The file that is *open*, not the one the highlight is standing on.
     *
     * Those were the same thing while moving through the tree opened files;
     * now that it does not, a titlebar reading the tree would name a file that
     * is not on screen. The unsaved marker has to come from the buffer for the
     * same reason - it used to read a flag beside the tree selection that was
     * written `false` and never written again, so it never once appeared.
     */
    const uri = useStoreValue<string | null>(EDITOR_URI, null) ?? null;
    useStoreSubtree(DOCUMENTS_ROOT);
    const name = uri ? tabLabel(uri) : undefined;
    const dirty = uri !== null && isDocumentDirty(runtime.store, uri);

    return (
      <Row gap={1} padding={{ left: 1, right: 1 }} bg="surfaceAlt" fg="text">
        <MenuBar />
        <text content={theme.glyphs.separator} fg="subtle" />
        <text content={workspace?.name ?? 'textide'} bold />
        {workspace?.readonly ? <text content="read-only" fg="warning" /> : null}
        <text content={theme.glyphs.separator} fg="subtle" />
        <text content={name ?? 'no file'} fg={name ? 'text' : 'muted'} flex={1} truncate="start" />
        {dirty ? <text content={`${theme.glyphs.bulletFilled} unsaved`} fg="warning" /> : null}
        <text content="ctrl+p" fg="subtle" />
      </Row>
    );
  });
