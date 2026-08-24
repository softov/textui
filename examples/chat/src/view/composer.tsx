import type { BoxProps, RenderOutput } from '@textui/core';
import { defineComponent, useTheme } from '@textui/core';
import type { ListItem } from '@textui/widgets';
import { Column, Divider, List, TextArea } from '@textui/widgets';
import { ComposerBar } from './controls.js';
import type { ComposerOption } from './controls.js';

/**
 * What you type, and one line saying what it will be sent as.
 *
 * The field itself is `TextArea` from the catalog - growing, scrolling and
 * giving back the keys it does not want is not a chat problem. What is here is
 * the rest of a composer: what enter means while a turn is running, the slash
 * menu over what has already been typed, and the control row.
 *
 * The row used to be four ghost buttons naming their own keys - `send enter`,
 * `newline alt+enter`, `stop ctrl+c`, `commands ctrl+p` - which spent the one
 * line under the field on a keyboard legend. The keys belong in the footer,
 * which already lists them and changes with where the focus is. The line under
 * the field is worth more as *what is about to happen*: which harness, which
 * model, what it may do without asking, where it runs.
 */

export interface ChatComposerProps extends BoxProps {
  value: string;
  onChange(value: string): void;
  onSubmit(value: string): void;
  onCancel?(): void;
  onHistory?(direction: -1 | 1): void;
  /** Left off the front of the field: out of the composer entirely. */
  onLeave?(): void;
  /** A turn is running: enter queues rather than sends, and stop is offered. */
  running?: boolean;
  queued?: number;
  /** The control row. Each is a value, and each may open a picker. */
  options?: ComposerOption[];
  onOption?(option: ComposerOption, anchorId: string): void;
  placeholder?: string;
  /** Offered when the draft starts with a slash. */
  commands?: { id: string; title: string; description?: string }[];
  autoFocus?: boolean;
  focusId?: string;
}

export const ChatComposer: (props: ChatComposerProps) => RenderOutput =
  defineComponent<ChatComposerProps>('ChatComposer', (props) => {
    const {
      value, onChange, onSubmit, onCancel, onHistory, onLeave, running, queued = 0,
      options = [], onOption, placeholder, commands = [], autoFocus,
      focusId = 'chat.composer', ...rest
    } = props;
    const theme = useTheme();

    // A slash menu is a completion over what is already typed, not a mode.
    const slash = value.startsWith('/') && !value.includes(' ') ? value.slice(1).toLowerCase() : null;
    const matches: ListItem[] = slash === null ? [] : commands
      .filter((command) => command.id.toLowerCase().includes(slash) || command.title.toLowerCase().includes(slash))
      .slice(0, 6)
      .map((command) => ({
        id: command.id,
        label: `/${command.id}`,
        ...(command.description ? { description: command.description } : {}),
        meta: command.title,
      }));

    return (
      <Column {...rest} gap={0}>
        {matches.length > 0 ? (
          // The theme's border, never a named one. A hardcoded `single` draws
          // a box-drawing frame inside an ascii one on a terminal that cannot
          // do either, and an airy theme gets a line it deliberately does not
          // draw anywhere else.
          <Column border={theme.border} padding={[0, 1]}>
            <List items={matches} focusable={false} emptyMessage="no command" />
          </Column>
        ) : null}

        <Column border={theme.border} padding={[0, 1]}>
          <TextArea
            value={value}
            onChange={onChange}
            onSubmit={onSubmit}
            {...(onCancel ? { onCancel } : {})}
            {...(onHistory ? { onOverflow: onHistory } : {})}
            {...(onLeave ? { onEdge: (edge: 'start' | 'end') => { if (edge === 'start') onLeave(); } } : {})}
            placeholder={placeholder
              ?? (running ? 'The agent is working. Type to queue a message.' : 'Ask the agent anything…')}
            focusId={focusId}
            // The caret is the one thing on this screen saying where typing
            // goes, and this field is the point of the screen.
            caretTone="accent"
            {...(autoFocus ? { autoFocus: true } : {})}
          />
          {/* Inside the same frame, so the field and what it will be sent as
              read as one control rather than two stacked boxes. */}
          <Divider />
          <ComposerBar
            options={options}
            onOpen={(option, anchorId) => onOption?.(option, anchorId)}
            onSend={() => onSubmit(value)}
            {...(running ? { running: true } : {})}
            queued={queued}
            sendDisabled={value.trim() === ''}
          />
        </Column>
      </Column>
    );
  });
