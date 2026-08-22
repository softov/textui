import {
  Button, Column, List, Row, ScrollView, defineComponent, useRuntime, useStoreValue,
} from '@textui/core';
import type {
  RenderOutput, Resource, ResourceKind, ResourceProvider, ResourceViewerDefinition,
  SemanticVariant,
} from '@textui/core';
import { EXTENSIONS_PATH, type LoadedExtension } from '../extensions.js';

/**
 * What is loaded, in the sidebar - and what one of them is, in a tab.
 *
 * The list is the store's, not the component's: `loadExtensions` publishes it
 * and this draws it. A panel that asked the loader directly would be a second
 * answer to one question, and it would be wrong the moment something was
 * disabled from the palette instead of from here.
 *
 * The sidebar is a narrow column, so it holds the list and a count and nothing
 * else. One extension is a *resource* - `extension:<id>` - which opens as a
 * tab through the registry, exactly the way `git:log/<path>` does. That is
 * what gives the detail room for its actions, a tab of its own, and a place
 * that remembers where it was looking; a footer under a twenty-two column list
 * gives it none of those.
 *
 * A failure is a row rather than an absence. An extension that did not load
 * used to be a toast that scrolled away and then nothing at all, which is what
 * makes "why is there no git" unanswerable.
 */

export const SCHEME = 'extension';
const PREFIX = `${SCHEME}:`;

export function extensionUri(id: string): string {
  return `${PREFIX}${encodeURIComponent(id)}`;
}

/** The extension id a `extension:...` URI is about, or null for anything else. */
export function extensionId(uri: string): string | null {
  return uri.startsWith(PREFIX) ? decodeURIComponent(uri.slice(PREFIX.length)) : null;
}

const TONE: Record<LoadedExtension['state'], SemanticVariant | undefined> = {
  loaded: undefined,
  failed: 'danger',
  disabled: 'muted',
};

/** "1 command", not "1 commands". A count of one is the common case here. */
function count(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/**
 * The line under the list.
 *
 * How many, and how many are wrong. Nothing about the selected one: what a
 * particular extension is has a tab of its own, and repeating a slice of it
 * down here would be a second place to keep it right.
 */
function summarize(extensions: LoadedExtension[]): { text: string; bad: boolean } {
  const problems = extensions.filter((e) => e.state === 'failed').length;
  const loaded = extensions.filter((e) => e.state === 'loaded').length;
  if (problems === 0) return { text: count(loaded, 'extension'), bad: false };
  // "loaded" rather than "extensions" once there is a second clause: the
  // sidebar is twenty-two columns and "0 extensions · 1 problem" is
  // twenty-four, so the half that matters most was the half being truncated.
  return { text: `${loaded} loaded · ${count(problems, 'problem')}`, bad: true };
}

export const ExtensionsPanel: (props: Record<string, never>) => RenderOutput =
  defineComponent<Record<string, never>>('ExtensionsPanel', () => {
    const runtime = useRuntime();
    const extensions = useStoreValue<LoadedExtension[]>(EXTENSIONS_PATH as never, []) ?? [];

    if (extensions.length === 0) {
      return (
        <Column flex={1}>
          <text content="Nothing loaded." fg="muted" />
          {/* Where they come from, because an empty panel that does not say
              how to fill it is a dead end. */}
          <text content="Add one to .textide.json" fg="subtle" wrap="word" />
        </Column>
      );
    }

    const summary = summarize(extensions);

    return (
      <Column flex={1} gap={0}>
        <List
          flex={1}
          // The first row, not none. A list that opens with nothing selected
          // makes the first `enter` do nothing and the first `down` skip a row.
          selectedId={extensions[0]?.source.id}
          items={extensions.map((extension) => ({
            id: extension.source.id,
            label: extension.source.displayName ?? extension.source.id,
            ...(TONE[extension.state] ? { tone: TONE[extension.state] } : {}),
          }))}
          onActivate={(id: string) => {
            void runtime.execute('extensions.show', { id });
          }}
        />
        <Row gap={1}>
          <text content={summary.text} fg={summary.bad ? 'danger' : 'muted'} truncate="end" />
        </Row>
      </Column>
    );
  });

/**
 * One extension, as a tab.
 *
 * The actions are in it rather than under the list, which is the difference
 * between a detail view and a caption. `disabled` is the one state where the
 * only useful action is the opposite one, so the button says so.
 */
export const ExtensionView: (props: { resource: Resource }) => RenderOutput =
  defineComponent<{ resource: Resource }>('ExtensionView', (props) => {
    const runtime = useRuntime();
    const extensions = useStoreValue<LoadedExtension[]>(EXTENSIONS_PATH as never, []) ?? [];
    const id = extensionId(props.resource.uri);
    const extension = extensions.find((e) => e.source.id === id);

    if (!extension) {
      return (
        <Column flex={1} padding={1}>
          <text content={`No extension named ${id ?? props.resource.uri}.`} fg="muted" wrap="word" />
        </Column>
      );
    }

    const { source, contributed, state } = extension;
    const facts: [string, string][] = [
      ['id', source.id],
      ...(source.version ? [['version', source.version] as [string, string]] : []),
      ['from', extension.specifier],
      ['state', state],
    ];

    return (
      <Column flex={1} padding={1} gap={1}>
        {/* The action sits on the title row, not at the end of the page. It
            is what somebody opened this to do, and anything below the fold in
            a twenty-row pane is a thing they will not find. */}
        <Row gap={2}>
          <text content={source.displayName ?? source.id} bold flex={1} truncate="end" />
          {state !== 'loaded'
            ? <text content={state} fg={state === 'failed' ? 'danger' : 'muted'} />
            : (
              <Button
                label="Disable"
                tone="danger"
                variant="outline"
                onPress={() => { void runtime.execute('extensions.disable', { id: source.id }); }}
              />
            )}
        </Row>

        {/* Everything else scrolls. A extension with forty commands is a
            normal extension, and a list that runs off the bottom of the pane
            with no way down is worse than no list. */}
        <ScrollView flex={1} scrollbar>
          <Column gap={1}>
            {source.description ? <text content={source.description} wrap="word" /> : null}

            {extension.error
              ? (
                <Column gap={0}>
                  <text content="Did not load" bold fg="danger" />
                  <text content={extension.error} fg="danger" wrap="word" />
                </Column>
              )
              : null}

            <Column gap={0}>
              {facts.map(([key, value]) => (
                <Row key={key} gap={1}>
                  <text content={key} fg="muted" width={9} />
                  <text content={value} flex={1} truncate="start" />
                </Row>
              ))}
            </Column>

            {/* What it put into the registries, by name rather than by count.
                A list of what one extension brought is the question this view
                exists to answer, and a number does not answer it. */}
            <Contributions title="Commands" names={contributed.commands} />
            <Contributions title="Resource kinds" names={contributed.kinds} />
            <Contributions title="Panels" names={contributed.views} />
          </Column>
        </ScrollView>
      </Column>
    );
  });

function Contributions({ title, names }: { title: string; names: string[] }): RenderOutput {
  if (names.length === 0) return null;
  return (
    <Column gap={0}>
      <text content={`${title} (${names.length})`} bold fg="muted" />
      {names.map((name) => <text key={name} content={name} truncate="end" />)}
    </Column>
  );
}

export const EXTENSION_KINDS: ResourceKind[] = [
  {
    id: 'extension',
    title: 'Extension',
    priority: 100,
    detect: (uri) => uri.startsWith(PREFIX),
  },
];

export const EXTENSION_VIEWERS: ResourceViewerDefinition[] = [
  { id: 'extension.view', title: 'Extension', kinds: ['extension'], component: 'ExtensionView', priority: 100 },
];

/**
 * Read-only, and it says so.
 *
 * There is nothing to write: what an extension *is* comes from its manifest,
 * and whether it is on is a command rather than a field. Declaring no `write`
 * capability is what stops the registry offering an editor that would fail on
 * save.
 */
export function createExtensionProvider(): ResourceProvider {
  return {
    scheme: SCHEME,
    stat(uri) {
      const id = extensionId(uri);
      if (id === null) return Promise.resolve(null);
      return Promise.resolve<Resource>({
        uri,
        kind: 'extension',
        metadata: { name: id, readonly: true },
        capabilities: ['read'],
      });
    },
    read: () => Promise.resolve(''),
  };
}
