import type { BoxProps, RenderOutput } from '@textui/core';
import { defineComponent, useI18n, useTheme } from '@textui/core';
import { Column, EmptyState, Row, ScrollView } from '@textui/widgets';
import type { DiffResult } from './diff.js';

/**
 * One file out of a changeset, both sides of it.
 *
 * Unified rather than side by side, and not for want of a splitter: a terminal
 * that a changeset list already shares with a session pane has sixty columns
 * left, and eighty characters of source in thirty is two columns of nothing
 * legible. Unified spends the width on the line instead.
 *
 * Every row is exactly one row tall. The scroll position is a row count, so a
 * line that wrapped would put the gutter numbers out of step with what is on
 * screen - which is the same invariant the markdown layout keeps, for the same
 * reason. Long lines are clipped, and the file is there to be read rather than
 * edited.
 */

export interface FileDiffProps extends BoxProps {
  /** The file, as the changeset names it. */
  path: string;
  diff: DiffResult;
  /** Absent `before` is a creation, absent `after` a deletion. */
  kind: 'new' | 'edited' | 'deleted';
  /** Set instead of a diff when the bytes are not text. */
  binary?: { bytes: number; contentType?: string };
}

export const FileDiff: (props: FileDiffProps) => RenderOutput =
  defineComponent<FileDiffProps>('FileDiff', (props) => {
    const { path, diff, kind, binary, ...rest } = props;
    const theme = useTheme();
    const i18n = useI18n();

    if (binary) {
      return (
        <EmptyState
          title={i18n.t('textui.fileDiff.binaryTitle', undefined, 'Not text')}
          message={i18n.plural(
            binary.bytes,
            {
              one: i18n.t('textui.fileDiff.binaryMessage.one', undefined, '{type}, {count} byte. There is nothing to show a line at a time.'),
              other: i18n.t('textui.fileDiff.binaryMessage.other', undefined, '{type}, {count} bytes. There is nothing to show a line at a time.'),
            },
            { type: binary.contentType ?? i18n.t('textui.fileDiff.binaryType', undefined, 'Binary') },
          )}
          {...rest}
        />
      );
    }

    if (diff.tooLarge) {
      return (
        <EmptyState
          title={i18n.t('textui.fileDiff.tooLargeTitle', undefined, 'Too big to line up')}
          message={i18n.plural(
            diff.tooLarge.lines,
            {
              one: i18n.t('textui.fileDiff.tooLargeMessage.one', undefined, '{count} line between the two sides, over the {limit} this will compare. Open it in an editor.'),
              other: i18n.t('textui.fileDiff.tooLargeMessage.other', undefined, '{count} lines between the two sides, over the {limit} this will compare. Open it in an editor.'),
            },
            { limit: diff.tooLarge.limit },
          )}
          {...rest}
        />
      );
    }

    if (diff.rows.length === 0) {
      return (
        <EmptyState
          title={i18n.t('textui.fileDiff.sameTitle', undefined, 'Nothing between the two')}
          message={i18n.t('textui.fileDiff.sameMessage', undefined, 'Both sides of this file are the same.')}
          {...rest}
        />
      );
    }

    // The widest line number either side will need, so the gutter does not
    // change width partway down the file.
    const width = String(Math.max(
      ...diff.rows.map((row) => Math.max(row.before ?? 0, row.after ?? 0)),
    )).length;

    return (
      <Column {...rest}>
        <Row gap={1}>
          <text
            content={kind === 'new' ? '+' : kind === 'deleted' ? '-' : theme.glyphs.chevronRight}
            fg={kind === 'new' ? 'success' : kind === 'deleted' ? 'danger' : 'muted'}
            shrink={0}
          />
          <text content={path} flex={1} truncate="start" />
          <text content={`+${diff.added}`} fg="success" shrink={0} />
          <text content={`-${diff.removed}`} fg="danger" shrink={0} />
        </Row>

        <ScrollView flex={1} focusId="changes.file">
          <Column>
            {diff.rows.map((row, index) => (
              <Row key={index} gap={1}>
                {/* Both gutters, always. A single number that means the left
                    file on one row and the right on the next is a number
                    nobody can use to find anything. */}
                <text
                  content={String(row.before ?? '').padStart(width)}
                  fg="subtle"
                  shrink={0}
                />
                <text
                  content={String(row.after ?? '').padStart(width)}
                  fg="subtle"
                  shrink={0}
                />
                <text
                  content={row.kind === 'added' ? '+' : row.kind === 'removed' ? '-' : ' '}
                  fg={row.kind === 'added' ? 'success' : row.kind === 'removed' ? 'danger' : 'muted'}
                  shrink={0}
                />
                <text
                  content={row.text}
                  wrap="none"
                  truncate="end"
                  flex={1}
                  {...(row.kind === 'added'
                    ? { fg: 'success' as const }
                    : row.kind === 'removed'
                      ? { fg: 'danger' as const }
                      : {})}
                />
              </Row>
            ))}
          </Column>
        </ScrollView>
      </Column>
    );
  });
