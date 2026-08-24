import type { RenderOutput } from '@textui/core';
import { defineComponent, useRuntime, useStoreValue } from '@textui/core';
import { Column, List, Row, panelViewPath } from '@textui/widgets';
import { EDITOR_URI, openTab, paneScope } from '../tabs.js';
import { SEARCH_RESULTS, SEARCH_SELECTED, SEARCH_STATE, byFile, summarise } from '../search.js';
import type { Hit, SearchState } from '../search.js';

/**
 * What the search found.
 *
 * The list is the store's, not this component's: the command fills it, this
 * draws it, and the panel that opens a hit is the same panel that opens a file
 * from the tree. A results view that ran its own search would be a second
 * answer to one question.
 *
 * Rows are grouped by file, in the order the walk found them, because "which
 * files is this in" is usually the question and a flat list of four hundred
 * lines answers it by accident at best.
 */
export const SearchResults: (props: Record<string, never>) => RenderOutput =
  defineComponent<Record<string, never>>('SearchResults', () => {
    const runtime = useRuntime();
    const hits = useStoreValue<Hit[]>(SEARCH_RESULTS, []) ?? [];
    const state = useStoreValue<SearchState>(SEARCH_STATE);
    const selected = useStoreValue<string>(SEARCH_SELECTED);

    /*
     * Nothing at all until something has been searched for.
     *
     * The panel surface in this shell has no visibility switch - whatever is
     * mounted there is on screen - so "empty" has to mean *no rows*, or the
     * editor loses a third of its height to a box saying nothing happened.
     */
    if (!state) return null;

    /*
     * A file row, then its lines. Both are rows in one list rather than a
     * tree: every one of them is a place to go, and a tree would make the
     * files expandable for no reason - there is nothing else under them.
     */
    const groups = byFile(hits);
    const items = groups.flatMap((group) => [
      {
        id: `file:${group.uri}`,
        label: `${group.name}  ${group.hits.length}`,
        tone: 'accent' as const,
      },
      // Keyed by position in `hits`, so opening one is a lookup and not a
      // search back through the grouping that produced it.
      ...group.hits.map((hit) => ({
        id: `hit:${hits.indexOf(hit)}`,
        // The line number first, because that is what a person scans down.
        label: `  ${String(hit.line + 1).padStart(5)}  ${hit.text}`,
      })),
    ]);

    const open = (id: string): void => {
      if (!id.startsWith('hit:')) return;
      const hit = hits[Number(id.slice(4))];
      if (!hit) return;

      openTab(runtime.store, hit.uri);
      runtime.store.set(EDITOR_URI, hit.uri);
      /*
       * And where in it.
       *
       * The panel remembers a caret per resource, so writing one here is the
       * same as having scrolled there - the editor picks it up when it mounts,
       * with no "go to line" plumbing in between.
       */
      runtime.store.set(panelViewPath(paneScope(0), hit.uri), {
        state: { line: hit.line, column: hit.column, top: Math.max(0, hit.line - 4) },
      });
    };

    /*
     * Bounded, and only as tall as it needs to be.
     *
     * A results panel is a visitor in the editor's space: eight rows is enough
     * to see what was found and few enough to keep reading the file behind it.
     */
    const rows = Math.min(8, Math.max(1, items.length));

    return (
      <Column height={rows + 1}>
        <Row padding={{ left: 1, right: 1 }} bg="surfaceAlt">
          <text content={summarise(hits, state)} fg={hits.length > 0 ? 'text' : 'muted'} flex={1} />
        </Row>
        <List
          items={items}
          selectedId={selected}
          onSelect={(id: string) => { runtime.store.set(SEARCH_SELECTED, id); }}
          onActivate={open}
          visibleRows={rows}
        />
      </Column>
    );
  });
