import {
  Column, List, Row, defineComponent, useRuntime, useStoreValue,
} from '@textui/core';
import type { BindingPath, RenderOutput, StatusSegment } from '@textui/core';
import type { Change, Status } from './git.js';

/**
 * What has changed, as a list.
 *
 * The list is the store's, not the component's: the commands refresh it and
 * this draws it, which is why staging from the palette and staging from this
 * panel light up the same row. A panel that ran `git status` itself would be
 * a second answer to one question, and the two would disagree the moment
 * anything was staged from anywhere else.
 */

export const GIT_ROOT = '$/plugins.git' as BindingPath;
export const STATUS_PATH = `${GIT_ROOT}/status` as BindingPath;
export const SELECTED_PATH = `${GIT_ROOT}/selected` as BindingPath;
export const STATUS_SEGMENTS = '$/ui/status/segments' as BindingPath;

/**
 * The two-letter code git prints, kept as git prints it.
 *
 * `M ` is staged, ` M` is not, `MM` is both, and a person who knows git reads
 * that faster than any words this could invent. The tone underneath says the
 * same thing again for anyone who does not.
 */
export function codeOf(change: Change): string {
  return `${change.index === ' ' ? '·' : change.index}${change.work === ' ' ? '·' : change.work}`;
}

export function toneOf(change: Change): 'success' | 'warning' | 'muted' {
  if (change.untracked) return 'muted';
  return change.staged && !change.unstaged ? 'success' : 'warning';
}

/** A one-line summary, for the status bar. */
export function summarize(status: Status | null): StatusSegment | null {
  if (!status) return null;
  const parts: string[] = [status.branch ?? 'detached'];
  if (status.ahead > 0) parts.push(`+${status.ahead}`);
  if (status.behind > 0) parts.push(`-${status.behind}`);
  const changed = status.changes.length;
  if (changed > 0) parts.push(`${changed} changed`);
  return {
    id: 'git',
    label: parts.join(' '),
    tone: status.clean ? undefined : 'warning',
  };
}

export const GitChanges: (props: Record<string, never>) => RenderOutput =
  defineComponent<Record<string, never>>('GitChanges', () => {
    const runtime = useRuntime();
    const status = useStoreValue<Status>(STATUS_PATH);
    const selected = useStoreValue<string>(SELECTED_PATH);

    if (!status) {
      return (
        <Column flex={1}>
          <text content="Not a git repository." fg="muted" />
        </Column>
      );
    }

    if (status.changes.length === 0) {
      return (
        <Column flex={1}>
          <Row gap={1}>
            <text content={status.branch ?? 'detached'} bold />
          </Row>
          <text content="Nothing to commit." fg="muted" />
        </Column>
      );
    }

    return (
      <Column flex={1}>
        <Row gap={1}>
          <text content={status.branch ?? 'detached'} bold flex={1} truncate="start" />
          <text content={String(status.changes.length)} fg="muted" />
        </Row>
        <List
          flex={1}
          items={status.changes.map((change) => ({
            id: change.path,
            // The code, then the path. Fixed width first so the column of
            // codes is a column and not a ragged left edge.
            label: `${codeOf(change)} ${change.path}`,
            tone: toneOf(change),
          }))}
          selectedId={selected}
          onSelect={(id: string) => { runtime.store.set(SELECTED_PATH, id); }}
          onActivate={(id: string) => {
            runtime.store.set(SELECTED_PATH, id);
            runtime.execute('git.diff');
          }}
        />
      </Column>
    );
  });
