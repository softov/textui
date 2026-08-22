import { Badge, List, Row, defineComponent, useTheme } from '@textui/core';
import type { BoxProps, ListItem, RenderOutput, SemanticVariant } from '@textui/core';
import type { SessionSummary } from '../ahp/types.js';
import { decodeStatus } from '../ahp/status.js';
import { workspaceName } from '../state.js';

/**
 * The catalogue.
 *
 * This one *is* a `List`. Rows are one line each, the height does not depend
 * on the content, and what a row needs - an icon, a label, a second line, a
 * right-hand meta - the component already has. Writing a bespoke list here
 * would have been the mistake the transcript is not.
 */

export interface SessionListProps extends BoxProps {
  sessions: SessionSummary[];
  selectedId?: string | null;
  onSelect?(uri: string): void;
  onOpen?(uri: string): void;
  emptyMessage?: string;
}

export const SessionList: (props: SessionListProps) => RenderOutput =
  defineComponent<SessionListProps>('SessionList', (props) => {
    const { sessions, selectedId, onSelect, onOpen, emptyMessage, ...rest } = props;
    const theme = useTheme();

    const items: ListItem[] = sessions.map((session) => {
      const status = decodeStatus(session.status);
      return {
        id: session.resource,
        // Glyph first, so the one that wants a person is findable in a piped
        // log, a 16-colour session and by a reader who cannot see the colour.
        icon: theme.glyphs[status.glyph],
        label: session.title,
        description: [
          session.provider,
          workspaceName(session.workingDirectories[0]),
          status.archived ? 'archived' : '',
        ].filter(Boolean).join(`  ${theme.glyphs.separator}  `),
        meta: status.label,
        tone: status.tone as SemanticVariant,
      };
    });

    return (
      <List
        items={items}
        {...(selectedId ? { selectedId } : {})}
        emptyMessage={emptyMessage ?? 'No sessions on this host'}
        onSelect={(id: string) => onSelect?.(id)}
        onActivate={(id: string) => onOpen?.(id)}
        {...rest}
      />
    );
  });

export interface ConnectionBadgeProps extends BoxProps {
  url: string;
  state: 'connecting' | 'connected' | 'offline';
  sessions?: number;
}

/** Which host, and whether it is answering. */
export const ConnectionBadge: (props: ConnectionBadgeProps) => RenderOutput =
  defineComponent<ConnectionBadgeProps>('ConnectionBadge', (props) => {
    const { url, state, sessions, ...rest } = props;
    const theme = useTheme();
    const look = {
      connected: { tone: 'success' as SemanticVariant, glyph: theme.glyphs.bulletFilled },
      connecting: { tone: 'warning' as SemanticVariant, glyph: theme.glyphs.bulletHalf },
      offline: { tone: 'danger' as SemanticVariant, glyph: theme.glyphs.cross },
    }[state];

    return (
      <Row gap={1} {...rest}>
        <text content={look.glyph} fg={look.tone} />
        <text content={url} fg="muted" truncate="start" />
        {sessions !== undefined ? <Badge label={`${sessions} sessions`} tone="muted" /> : null}
      </Row>
    );
  });
