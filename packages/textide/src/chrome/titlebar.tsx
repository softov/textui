import { Row, useStoreValue, useTheme, defineComponent } from '@textui/core';
import type { RenderOutput } from '@textui/core';
import type { Workspace } from '../workspace.js';
import { WORKSPACE_PATH } from '../workspace.js';
import { ACTIVE_PATH } from '../filesystem.js';
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
    const workspace = useStoreValue<Workspace>(WORKSPACE_PATH);
    const name = useStoreValue<string>(`${ACTIVE_PATH}/name`);
    const dirty = useStoreValue<boolean>(`${ACTIVE_PATH}/dirty`, false);

    return (
      <Row gap={1} padding={{ left: 1, right: 1 }} bg="surface" fg="text">
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
