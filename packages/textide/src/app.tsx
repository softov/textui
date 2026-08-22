import {
  Column, KeyHints, Row, Tabs, defineComponent, useCapabilities, useEffect, useFocusScope,
  useRuntime, useStoreSubtree, useStoreValue,
} from '@textui/core';
import type { RenderOutput, Resource } from '@textui/core';
import { DOCUMENTS_ROOT, ResourceExplorer, ResourceView, isDocumentDirty } from '@textui/documents';
import { ACTIVE_PATH } from './filesystem.js';
import { WORKSPACE_PATH, type Workspace } from './workspace.js';
import { iconsFor } from './icons.js';
import {
  EDITOR_SELECTION, EDITOR_URI, SPLIT_PATH, TABS_PATH, openTab, reconcileTabs, tabLabel,
} from './tabs.js';

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
 * is what the tab strip below exploits: a pane is a viewer and a URI, so a
 * second pane is a second URI and nothing else.
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
      if (resource.capabilities.includes('list')) {
        runtime.store.set(EDITOR_URI, null);
        return;
      }
      openTab(runtime.store, resource.uri);
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

interface PaneProps {
  uri: string | null;
  /** The focus scope this pane registers, so "am I in here" has an answer. */
  scopeId: string;
  /** Only one pane takes focus when edit mode is entered. */
  primary?: boolean;
}

/**
 * One pane: a rule, and whatever the registry says opens this URI.
 *
 * The pane is a focus *scope*, not a focusable.
 *
 * It was a tab stop, which meant reaching the editor took two presses: one
 * onto the pane and another onto the thing inside it. A pane is not a control.
 * Making it a scope means whatever it contains registers inside it, and "am I
 * in here" is a question about the published focus rather than about this
 * component holding focus itself.
 */
const Pane = defineComponent<PaneProps>('EditorPane', ({ uri, scopeId, primary }) => {
  const runtime = useRuntime();
  const Icon = iconsFor(useCapabilities().unicode);
  const mode = useStoreValue<'view' | 'edit'>('$/ui/editor/mode', 'view');
  /*
   * The scope takes the keyboard back when whatever had it goes away.
   *
   * Leaving edit mode unmounts the editor, and unregistering the focused
   * control leaves focus null - so the viewer that replaced it drew fine and
   * read no keys, and the markdown you had been scrolling a moment ago stopped
   * scrolling. `autoFocus` on the scope fires as its first control arrives and
   * only when *nothing at all* holds focus, which is the difference between
   * this and stealing focus off the tree when a file is opened.
   *
   * Only the primary pane asks. Two panes both claiming an unclaimed keyboard
   * is a race whose winner is whichever rendered first.
   */
  const scope = useFocusScope({ id: scopeId, autoFocus: primary === true });
  const focusedScope = useStoreValue<string | null>('$/focus/scope', null);
  const active = focusedScope === scope;

  return (
    <Row flex={1} align="stretch" id={scopeId}>
      <box width={1} fill={Icon.activeRule} fg={active ? 'focus' : 'borderSubtle'} />
      {/*
        * Entering edit mode means going to the editor. The editor claims focus
        * as it mounts rather than something outside chasing it once it has -
        * the mounting render is the first moment it exists. Only the primary
        * pane does it, because two panes both claiming focus is a race whose
        * winner depends on the order they happen to render in.
        */}
      <ResourceView
        uri={uri ?? null}
        mode={mode}
        // How much is selected is a fact about the screen, so it goes in the
        // store and the status bar reads it there. The editor keeps the
        // selection itself - where the caret is is nobody else's business -
        // and reports the one number somebody outside it wants.
        viewerProps={mode === 'edit'
          ? {
              ...(primary ? { autoFocus: true } : {}),
              onSelection: {
                handler: (selection: { chars: number; lines: number }) => {
                  if (primary) runtime.store.set(EDITOR_SELECTION, selection);
                },
              },
            }
          : undefined}
        flex={1}
      />
    </Row>
  );
});

/** The tab strip, the pane or panes, and the key hints - the `main` surface. */
export const Editor: (props: Record<string, never>) => RenderOutput =
  defineComponent<Record<string, never>>('Editor', () => {
    const runtime = useRuntime();
    const uri = useStoreValue<string | null>(EDITOR_URI, null);
    const mode = useStoreValue<'view' | 'edit'>('$/ui/editor/mode', 'view');
    const tabs = useStoreValue<string[]>(TABS_PATH, []) ?? [];
    const split = useStoreValue<string | null>(SPLIT_PATH, null);
    const Icon = iconsFor(useCapabilities().unicode);
    // The unsaved marker is the buffer's, so this has to hear about the buffer
    // changing - a strip that reads dirtiness without subscribing to it shows
    // the answer from whenever it last happened to redraw.
    useStoreSubtree(DOCUMENTS_ROOT);

    // Anything may set the active URI - a command, a test, an extension that
    // has never heard of a strip - so the strip agrees with it rather than
    // being the only way to open a file.
    useEffect(() => { reconcileTabs(runtime.store); }, [uri]);

    return (
      <Column flex={1}>
        {tabs.length > 1
          ? (
            <Tabs
              items={tabs.map((tab) => ({
                id: tab,
                label: tabLabel(tab),
                // A glyph, not only a colour: a screenshot and a 16-colour
                // session both lose the colour and neither loses the dot.
                ...(isDocumentDirty(runtime.store, tab) ? { badge: Icon.dirty } : {}),
              }))}
              activeId={uri ?? undefined}
              onChange={(next: string) => { runtime.store.set(EDITOR_URI, next); }}
            />
            )
          : null}

        {split
          ? (
            <Row flex={1} gap={1}>
              <Pane uri={uri ?? null} scopeId="pane.main" primary />
              <Pane uri={split} scopeId="pane.split" />
            </Row>
            )
          : <Pane uri={uri ?? null} scopeId="pane.main" primary />}

        {/*
          * The hints are what you can do *here*, so editing gets the editing
          * keys. A row that listed both sets would be a row nobody reads.
          *
          * Five each, and the fifth is the way to the rest. A footer with
          * thirty keys on it is a footer the terminal truncates into ellipses,
          * which is a row that has stopped saying anything at all - the full
          * sheet is one keypress away and it can be read.
          */}
        <KeyHints
          hints={mode === 'edit'
            ? [
                { keys: 'ctrl+s', label: 'save' },
                { keys: 'ctrl+z', label: 'undo' },
                { keys: 'ctrl+c/x/v', label: 'clip' },
                { keys: 'ctrl+e', label: 'view' },
                { keys: 'alt+?', label: 'keys' },
              ]
            : [
                { keys: 'enter', label: 'open' },
                { keys: 'alt+arrows', label: 'files' },
                { keys: 'ctrl+p', label: 'commands' },
                { keys: 'ctrl+e', label: 'edit' },
                { keys: 'alt+?', label: 'keys' },
              ]}
        />
      </Column>
    );
  });
