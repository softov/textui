import {
  Column, KeyHints, Row, Tabs, defineComponent, panelRendererPath, useCapabilities,
  useEffect, useRuntime, useStoreSubtree, useStoreValue,
} from '@textui/core';
import type { PanelRenderer, RenderOutput, Resource } from '@textui/core';
import { DOCUMENTS_ROOT, ResourceExplorer, ResourceView, isDocumentDirty } from '@textui/documents';
import { ACTIVE_PATH } from './filesystem.js';
import { WORKSPACE_PATH, type Workspace } from './workspace.js';
import { iconsFor } from './icons.js';
import {
  EDITOR_MODE, EDITOR_URI, GROUPS_PATH, GROUP_PATH, LAYOUT_PATH, activateTab,
  openTab, paneScope, reconcileTabs, tabLabel, type EditorLayout, type Group,
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
    const Icon = iconsFor(useCapabilities().unicode);

    /*
     * Moving the highlight is not opening anything.
     *
     * It was: `onSelect` opened whatever the highlight landed on, so rolling
     * down past a folder of fifteen files opened fifteen tabs, read fifteen
     * files off the disk and left a strip nobody asked for. Moving through a
     * tree is how you *look* for something.
     *
     * What a move does publish is what is selected, because that is what the
     * commands act on - `New File` puts a file in the folder you are standing
     * on, whether or not anything is open.
     */
    const select = (resource: Resource): void => {
      runtime.store.set(ACTIVE_PATH, {
        uri: resource.uri,
        name: resource.metadata.name,
        kind: resource.kind,
        size: resource.metadata.size,
      });
    };

    const open = (resource: Resource): void => {
      select(resource);
      // A directory has nothing to show, and asking a viewer to open one is
      // how a pane fills with an error nobody caused. Enter on one expands it,
      // which the tree has already done by the time this runs.
      if (resource.capabilities.includes('list')) return;
      openTab(runtime.store, resource.uri);
    };

    return (
      <ResourceExplorer
        root={workspace?.rootUri ?? ''}
        onSelect={select}
        onOpen={open}
        // Which marks mean folder is textide's vocabulary, not the explorer's:
        // the tier a terminal can draw is known here and nowhere else.
        folderIcons={{ folder: Icon.folder, folderOpen: Icon.folderOpen }}
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
  /** Which group this pane draws. */
  group: number;
  /** True for the group the keyboard is in. Only that one claims focus. */
  primary: boolean;
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
const Pane = defineComponent<PaneProps>('EditorPane', ({ uri, scopeId, group, primary }) => {
  const runtime = useRuntime();
  const Icon = iconsFor(useCapabilities().unicode);
  const focusedScope = useStoreValue<string | null>('$/focus/scope', null);
  const active = focusedScope === scopeId;
  /*
   * What is on screen is the panel's answer, not a mode this file keeps.
   *
   * A file is a resource; a panel is where one is shown; which component draws
   * it is a late choice between everything registered for its kind. "Edit" is
   * one of those choices - the one that writes back - so it is read off the
   * renderer rather than being a flag that has to be kept in step with it.
   */
  const renderer = useStoreValue<PanelRenderer | null>(panelRendererPath(scopeId), null);
  const editing = renderer?.saves === true;

  // The group the keyboard is in is wherever the keyboard actually is. A pane
  // that reported it only when clicked would disagree with focus the moment
  // anything moved focus another way.
  useEffect(() => {
    if (active) runtime.store.set(GROUP_PATH, group);
  }, [active, group]);

  // Republished under the old name for the chrome that asks "are we editing" -
  // the status bar, the key hints - so one question has one answer whichever
  // way it is asked.
  useEffect(() => {
    if (primary) runtime.store.set(EDITOR_MODE, editing ? 'edit' : 'view');
  }, [primary, editing]);

  return (
    <Row flex={1} align="stretch" id={`${scopeId}:pane`}>
      <box width={1} fill={Icon.activeRule} fg={active ? 'focus' : 'borderSubtle'} />
      {/*
        * The panel is the focus scope, so entering the editor is one press and
        * not two, and leaving it hands the keyboard to whatever replaced it.
        * `autoFocus` fires only when nothing at all holds focus - two panes
        * both claiming an unclaimed keyboard is a race whose winner is
        * whichever rendered first, so only the primary asks.
        */}
      <ResourceView
        id={scopeId}
        uri={uri ?? null}
        autoFocus={primary}
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
    const groups = useStoreValue<Group[]>(GROUPS_PATH, []) ?? [];
    const focused = useStoreValue<number>(GROUP_PATH, 0) ?? 0;
    const layout = useStoreValue<EditorLayout>(LAYOUT_PATH, 'tabs') ?? 'tabs';
    const Icon = iconsFor(useCapabilities().unicode);
    // The unsaved marker is the buffer's, so this has to hear about the buffer
    // changing - a strip that reads dirtiness without subscribing to it shows
    // the answer from whenever it last happened to redraw.
    useStoreSubtree(DOCUMENTS_ROOT);

    // Anything may set the active URI - a command, a test, an extension that
    // has never heard of a group - so the strips agree with it rather than
    // being the only way to open a file.
    useEffect(() => { reconcileTabs(runtime.store); }, [uri]);

    const live: Group[] = groups.length > 0 ? groups : [{ tabs: [], active: null }];
    const at = Math.max(0, Math.min(focused, live.length - 1));
    /**
     * One group: its own strip, and the file that strip has forward.
     *
     * The strip is drawn for a group with one tab as soon as there are two
     * groups, because in a split the strip is what says which half is showing
     * what - and dropped for a single group with a single tab, where it would
     * be a row costing a line to say what the titlebar already says.
     */
    /*
     * `basis={0}` is what makes two groups the same size.
     *
     * `flex` divides what is *left over* after every child has taken its
     * content size, so a group showing 90-column lines starts 90 columns wide
     * and a group showing `aaa` starts three - and the split came out as a
     * sliver beside a pane. Starting both at nothing means the whole axis is
     * what gets divided. It reads as a wrapping bug and is a sizing one, which
     * is why hiding the sidebar appeared to fix it: more free space to share
     * made the difference between the two look smaller.
     */
    const groupNode = (group: Group, index: number): RenderOutput => (
      <Column key={String(index)} flex={1} basis={0}>
        {group.tabs.length > 1 || live.length > 1
          ? (
            <Tabs
              items={group.tabs.map((tab) => ({
                id: tab,
                label: tabLabel(tab),
                // A glyph, not only a colour: a screenshot and a 16-colour
                // session both lose the colour and neither loses the dot.
                ...(isDocumentDirty(runtime.store, tab) ? { badge: Icon.dirty } : {}),
              }))}
              activeId={group.active ?? undefined}
              onChange={(next: string) => { activateTab(runtime.store, index, next); }}
            />
            )
          : null}
        <Pane
          uri={group.active}
          scopeId={paneScope(index)}
          group={index}
          primary={index === at}
        />
      </Column>
    );

    return (
      <Column flex={1}>
        {live.length === 1
          ? groupNode(live[0] as Group, 0)
          : layout === 'stack'
            ? <Column flex={1} gap={1}>{live.map(groupNode)}</Column>
            // `stretch`, or a row sizes its children to their content and
            // centres them: two half-height panes floating in the middle of a
            // pane that is the right height.
            : <Row flex={1} gap={1} align="stretch">{live.map(groupNode)}</Row>}

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
                { keys: 'f1', label: 'keys' },
              ]
            : [
                { keys: 'enter', label: 'open' },
                { keys: 'alt+arrows', label: 'files' },
                { keys: 'ctrl+p', label: 'commands' },
                { keys: 'ctrl+e', label: 'edit' },
                { keys: 'f1', label: 'keys' },
              ]}
        />
      </Column>
    );
  });
