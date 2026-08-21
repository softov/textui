import {
  Column, KeyHints, Row, defineComponent, useCapabilities, useFocusScope, useRuntime,
  useStoreValue,
} from '@textui/core';
import type { RenderOutput, Resource } from '@textui/core';
import { ResourceExplorer, ResourceView } from '@textui/documents';
import { ACTIVE_PATH } from './filesystem.js';
import { WORKSPACE_PATH, type Workspace } from './workspace.js';
import { iconsFor } from './icons.js';

/**
 * The screen, as surfaces.
 *
 * The shell owns where things go - sidebar left, main beside it, header and
 * status top and bottom - so this file mounts into those regions rather than
 * drawing a frame of its own. Drawing one anyway is how an application ends up
 * with two sidebars: the shell reserves its column, and the screen paints
 * another inside `main`.
 *
 * Splitting the explorer from the viewer is what makes that possible, and it
 * is the same split that the tabs round will exploit.
 */

/** The tree, for the `sidebar` surface. */
export const Explorer: (props: Record<string, never>) => RenderOutput =
  defineComponent<Record<string, never>>('Explorer', () => {
    const runtime = useRuntime();
    const workspace = useStoreValue<Workspace>(WORKSPACE_PATH);

    const select = (resource: Resource): void => {
      runtime.store.set(ACTIVE_PATH, {
        uri: resource.uri,
        name: resource.metadata.name,
        kind: resource.kind,
        size: resource.metadata.size,
        dirty: false,
      });
      // A directory has nothing to show, and asking a viewer to open one is
      // how a pane fills with an error nobody caused.
      runtime.store.set(
        '$/ui/editor/uri',
        resource.capabilities.includes('list') ? null : resource.uri,
      );
    };

    return (
      <ResourceExplorer
        root={workspace?.rootUri ?? ''}
        onSelect={select}
        onOpen={select}
        // Somewhere to start. An application that boots with nothing focused
        // sends the first arrow key to whatever happens to be first in the tab
        // order, which here is the menu bar.
        autoFocus
        flex={1}
      />
    );
  });

/** The viewer and the key hints, for the `main` surface. */
export const Editor: (props: Record<string, never>) => RenderOutput =
  defineComponent<Record<string, never>>('Editor', () => {
    const uri = useStoreValue<string | null>('$/ui/editor/uri', null);
    const mode = useStoreValue<'view' | 'edit'>('$/ui/editor/mode', 'view');

    /**
     * The pane is a focus *scope*, not a focusable.
     *
     * It was a tab stop, which meant reaching the editor took two presses: one
     * onto the pane and another onto the thing inside it. A pane is not a
     * control. Making it a scope means whatever it contains registers inside
     * it, and "am I in here" is a question about the published focus rather
     * than about this component holding focus itself.
     */
    const Icon = iconsFor(useCapabilities().unicode);
    const scope = useFocusScope({ id: 'pane.main' });
    const focusedScope = useStoreValue<string | null>('$/focus/scope', null);
    const active = focusedScope === scope;

    return (
      <Row flex={1} align="stretch" id="pane.main">
        <box
          width={1}
          fill={Icon.activeRule}
          fg={active ? 'focus' : 'borderSubtle'}
        />
        <Column flex={1}>
        {/*
          * Entering edit mode means going to the editor. The editor claims
          * focus as it mounts rather than something outside chasing it once it
          * has - the mounting render is the first moment it exists.
          */}
        <ResourceView
          uri={uri ?? null}
          mode={mode}
          viewerProps={mode === 'edit' ? { autoFocus: true } : undefined}
          flex={1}
        />
        <KeyHints
          hints={[
            { keys: 'up/down', label: 'move' },
            { keys: 'right', label: 'expand' },
            { keys: 'enter', label: 'open' },
            { keys: 'ctrl+b', label: 'sidebar' },
            { keys: 'ctrl+p', label: 'commands' },
            { keys: 'ctrl+e', label: mode === 'edit' ? 'view' : 'edit' },
            { keys: 'q', label: 'quit' },
          ]}
        />
        </Column>
      </Row>
    );
  });
