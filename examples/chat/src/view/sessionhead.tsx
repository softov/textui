import type { BoxProps, RenderOutput } from '@textui/core';
import { defineComponent, useTheme } from '@textui/core';
import { Row } from '@textui/widgets';
import type { SessionSummary } from '../ahp/types.js';
import { workspaceName } from '../state.js';

/**
 * What this conversation *is*, above the conversation itself.
 *
 * The application header says which session is open, and it is one line shared
 * with the application's own name - so what it can hold is a title and a
 * workspace. Everything else about a session lives on the catalogue's detail
 * pane, which is a screen away: when it started, which harness, what it last
 * ran on, and the uri you paste into a shell.
 *
 * Those are the things a person scrolls up looking for and does not find, so
 * they go here: once, above the transcript, outside the scrolling region. Two
 * lines, because it is a caption and not a pane - anything that needs more
 * than that belongs on the screen that already shows it in full.
 */

export interface ChatSessionHeadProps extends BoxProps {
  session: SessionSummary;
  /** What the last turn ran on. A session has no model; each message has one. */
  model?: string;
  /** The chat uri, when the host has said which one this dispatches to. */
  chat?: string | null;
}

/**
 * A timestamp a person can read, in whatever this machine calls a date.
 *
 * The host sends ISO, which is unambiguous and not what anybody wants to read
 * off a caption. An unparseable one is passed through rather than shown as
 * "Invalid Date": what the host said is more useful than what we made of it.
 */
function when(iso: string | undefined): string {
  if (!iso) return '';
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;
  return at.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export const ChatSessionHead: (props: ChatSessionHeadProps) => RenderOutput =
  defineComponent<ChatSessionHeadProps>('ChatSessionHead', (props) => {
    const { session, model, chat, ...rest } = props;
    const theme = useTheme();
    const dot = theme.glyphs.separator;

    // Only what is known. A row of "· · ·" with nothing between the dots is
    // what building this from a fixed list of fields produces.
    const facts = [
      session.provider,
      model,
      workspaceName(session.workingDirectories[0]),
      when(session.createdAt),
    ].filter((fact): fact is string => Boolean(fact));

    // The title is not here. It is on the line directly above this one, in
    // the application's own header, and repeating it costs the width that the
    // things the header could not fit need.
    return (
      <Row {...rest} gap={1}>
        <text content={facts.join(`  ${dot}  `)} fg="muted" truncate="end" shrink={1} />
        <text content="" flex={1} />
        {/* Last, and the first to go: the longest thing on the row, and the
            one there is a whole screen for. Truncated in the middle, because
            a uri you can read half of looks like the whole thing. */}
        <text content={chat ?? session.resource} fg="subtle" truncate="middle" shrink={8} />
      </Row>
    );
  });
