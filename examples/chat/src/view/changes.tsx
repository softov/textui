import { Column, EmptyState, Row, defineComponent, useTheme } from '@textui/core';
import type { BoxProps, RenderOutput } from '@textui/core';
import type { Changeset } from '../ahp/types.js';

/**
 * What the session changed on disk.
 *
 * Not read off the tool calls: a provider decides whether to send `fileEdit`
 * blocks and this one sends none, so a client that reads them reports that a
 * turn which created one file and rewrote another touched nothing. The account
 * is the changeset channel, and `computing` is worth showing rather than
 * swallowing - a partial answer read as a complete one is the wrong kind of
 * wrong.
 */

export interface ChangesListProps extends BoxProps {
  changes: Changeset;
}

export const ChangesList: (props: ChangesListProps) => RenderOutput =
  defineComponent<ChangesListProps>('ChangesList', (props) => {
    const { changes, ...rest } = props;
    const theme = useTheme();

    if (changes.files.length === 0) {
      return (
        <EmptyState
          title={changes.status === 'computing' ? 'Working out what changed' : 'Nothing changed'}
          message={changes.status === 'computing' ? 'The host is still computing the changeset.' : 'No file was created, edited or deleted.'}
          {...rest}
        />
      );
    }

    return (
      <Column {...rest}>
        {changes.status === 'computing' ? (
          <text content={`${theme.glyphs.ellipsis} still computing - this is not the whole list`} fg="warning" />
        ) : null}
        {changes.files.map((file) => {
          const kind = !file.before ? 'new' : !file.after ? 'deleted' : 'edited';
          const tone = kind === 'new' ? 'success' : kind === 'deleted' ? 'danger' : 'muted';
          return (
            <Row key={file.uri} gap={1}>
              <text
                content={kind === 'new' ? '+' : kind === 'deleted' ? '-' : theme.glyphs.chevronRight}
                fg={tone}
              />
              <text content={file.uri.replace(/^file:\/\//, '')} flex={1} truncate="start" />
              <text content={`+${file.diff.added}`} fg="success" />
              <text content={`-${file.diff.removed}`} fg="danger" />
            </Row>
          );
        })}
      </Column>
    );
  });
