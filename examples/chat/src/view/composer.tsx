import { Button, Column, List, Row, TextArea, defineComponent, useTheme } from '@textui/core';
import type { BoxProps, ListItem, RenderOutput } from '@textui/core';

/**
 * What you type, and everything around it.
 *
 * The field itself is `TextArea` from the catalog - growing, scrolling and
 * giving back the keys it does not want is not a chat problem. What is here is
 * the rest of a composer: what enter means while a turn is running, the slash
 * menu over what has already been typed, and the row of actions.
 */

export interface ChatComposerProps extends BoxProps {
  value: string;
  onChange(value: string): void;
  onSubmit(value: string): void;
  onCancel?(): void;
  onHistory?(direction: -1 | 1): void;
  onStop?(): void;
  /** A turn is running: enter queues rather than sends, and stop is offered. */
  running?: boolean;
  queued?: number;
  /** Right of the actions: the model, the workspace, whatever is true. */
  meta?: string;
  /** Offered when the draft starts with a slash. */
  commands?: { id: string; title: string; description?: string }[];
  autoFocus?: boolean;
  focusId?: string;
}

/**
 * The composer: a field, what the keys do, and what is in the way.
 *
 * The actions are ghost buttons - a glyph and a label, no border - because a
 * bordered control here would draw a second frame inside the one the composer
 * already is, and there are four of them.
 */
export const ChatComposer: (props: ChatComposerProps) => RenderOutput =
  defineComponent<ChatComposerProps>('ChatComposer', (props) => {
    const {
      value, onChange, onSubmit, onCancel, onHistory, onStop, running, queued = 0,
      meta, commands = [], autoFocus, focusId = 'chat.composer', ...rest
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
          <Column border="single" padding={[0, 1]}>
            <List items={matches} focusable={false} emptyMessage="no command" />
          </Column>
        ) : null}

        <Column border="single" padding={[0, 1]}>
          <TextArea
            value={value}
            onChange={onChange}
            onSubmit={onSubmit}
            {...(onCancel ? { onCancel } : {})}
            {...(onHistory ? { onOverflow: onHistory } : {})}
            placeholder={running ? 'The agent is working. Type to queue a message.' : 'Ask, or paste a path. Enter sends.'}
            focusId={focusId}
            {...(autoFocus ? { autoFocus: true } : {})}
          />
          <Row gap={2}>
            <Button
              label={running ? 'queue' : 'send'}
              variant="ghost"
              icon={theme.glyphs.chevronRight}
              hint="enter"
              onPress={() => onSubmit(value)}
            />
            <Button label="newline" variant="ghost" icon={theme.glyphs.arrowDown} hint="alt+enter" onPress={() => onChange(`${value}\n`)} />
            {running && onStop ? (
              <Button label="stop" variant="ghost" tone="danger" icon={theme.glyphs.cross} hint="ctrl+c" onPress={onStop} />
            ) : null}
            <Button label="commands" variant="ghost" icon={theme.glyphs.search} hint="ctrl+p" onPress={() => undefined} disabled />
            <text content="" flex={1} />
            {queued > 0 ? <text content={`${queued} queued`} fg="warning" /> : null}
            {meta ? <text content={meta} fg="subtle" /> : null}
          </Row>
        </Column>
      </Column>
    );
  });
