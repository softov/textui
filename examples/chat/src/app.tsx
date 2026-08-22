import {
  KeyHints, Row, createBag, defineComponent, registerBuiltins, useApp, useTheme,
  useStoreValue,
} from '@textui/core';
import type { BoxProps, Disposable, TextUIApp } from '@textui/core';
import { CONTROLLER, createController } from './control.js';
import { fakeHost } from './ahp/fake.js';
import type { HostConnection } from './ahp/connection.js';
import { HOST, INPUT, STATUS, openSession, workspaceName } from './state.js';
import type { HostState } from './state.js';
import { decodeStatus } from './ahp/status.js';
import {
  ChangesScreen, ChatScreen, HostsScreen, NewSessionScreen, SessionsScreen, SettingsScreen,
} from './screens.js';
import { ChatBubble, ReasoningBlock, StreamingText } from './view/bubble.js';
import { ChatComposer } from './view/composer.js';
import { ChatHitl } from './view/hitl.js';
import { ChatTranscript } from './view/transcript.js';
import { ChangesList } from './view/changes.js';
import { ConnectionBadge, SessionList } from './view/sessions.js';
import { ToolCallRow } from './view/toolcall.js';

/**
 * A chat client for an agent host.
 *
 * What it is here to find out is which components a chat application needs
 * that a terminal UI catalog does not already have. The answer, by the end of
 * writing it, is in `README.md` - and the shape of the answer is that the
 * conversation is one component the catalog cannot stand in for, the composer
 * is a second, and everything else is composition.
 *
 * The application takes a host rather than making one, so a test can mount it
 * against a scripted one and drive time by hand.
 */

const Header = defineComponent<Record<string, never>>('ChatHeader', () => {
  const app = useApp();
  const theme = useTheme();
  const host = useStoreValue<HostState>(HOST);
  const status = useStoreValue<number>(STATUS, 1) ?? 1;
  const session = openSession(app.store);
  const decoded = decodeStatus(status);

  return (
    <Row gap={1} padding={[0, 1]}>
      <text content="Assistant" bold fg="accent" />
      <text content={theme.glyphs.separator} fg="subtle" />
      {session ? (
        <>
          <text content={theme.glyphs[decoded.glyph]} fg={decoded.tone} />
          <text content={session.title} flex={1} truncate="end" />
          <text content={workspaceName(session.workingDirectories[0])} fg="muted" />
        </>
      ) : (
        <text content={host?.url ?? 'no host'} fg="muted" flex={1} />
      )}
    </Row>
  );
});

/**
 * The keys, as the reader sees them.
 *
 * They change with where the focus is, because they *are* different there:
 * while the composer has the keyboard, every letter is a letter.
 */
const Hints = defineComponent<BoxProps>('ChatHints', (props) => {
  const app = useApp();
  const theme = useTheme();
  const waiting = useStoreValue<{ kind: string } | null>(INPUT, null);
  const arrows = `${theme.glyphs.arrowUp}${theme.glyphs.arrowDown}`;
  // Which keys exist is a property of where you are, not of what is open: a
  // session stays open while its changes are on screen, and `i write` there
  // is an offer nothing honours.
  const screen = app.screens.current()?.id ?? 'sessions';
  const running = (useStoreValue<number>(STATUS, 1) ?? 1) > 1;

  // A question is not a confirmation, and the keys are not the same either.
  // Offering "a approve" over an elicitation is the same mistake as rendering
  // one as the other, made in the one row that is supposed to explain it.
  if (screen === 'chat' && waiting?.kind === 'toolConfirmation') {
    return (
      <KeyHints
        {...props}
        hints={[
          { keys: 'a', label: 'approve' },
          { keys: 'd', label: 'deny' },
          { keys: '1-9', label: 'option' },
          { keys: 'esc', label: 'read' },
        ]}
      />
    );
  }

  if (screen === 'chat' && waiting) {
    return (
      <KeyHints
        {...props}
        hints={[
          { keys: 'tab', label: 'next question' },
          { keys: 'space', label: 'choose' },
          { keys: 'enter', label: 'send answers' },
          { keys: 'esc', label: 'read' },
        ]}
      />
    );
  }

  if (screen === 'chat') {
    return (
      <KeyHints
        {...props}
        hints={[
          { keys: 'enter', label: 'send' },
          { keys: 'esc', label: 'read' },
          { keys: 'i', label: 'write' },
          { keys: 'G', label: 'follow' },
          { keys: 'c', label: 'changes' },
          // The same key, and it does say which: while a turn is running it
          // stops it, and when none is it leaves. A hint that always read
          // "stop" is a hint that is wrong most of the time.
          { keys: 'ctrl+c', label: running ? 'stop' : 'quit' },
        ]}
      />
    );
  }

  if (screen !== 'sessions') {
    return (
      <KeyHints
        {...props}
        hints={[
          { keys: 'tab', label: 'move' },
          { keys: 'esc', label: 'back' },
          { keys: 'ctrl+p', label: 'commands' },
          { keys: 'ctrl+c', label: 'quit' },
        ]}
      />
    );
  }

  return (
    <KeyHints
      {...props}
      hints={[
        { keys: arrows, label: 'move' },
        { keys: 'enter', label: 'open' },
        { keys: 'n', label: 'new' },
        { keys: 'a', label: 'archive' },
        { keys: '/', label: 'filter' },
        { keys: 'ctrl+p', label: 'commands' },
        { keys: 'ctrl+c', label: 'quit' },
      ]}
    />
  );
});

const Status = defineComponent<Record<string, never>>('ChatStatus', () => {
  const app = useApp();
  const theme = useTheme();
  const screen = app.screens.current();
  return (
    <Row gap={2}>
      <Hints flex={1} />
      <text
        content={[screen?.id ?? '-', app.screens.canGoBack() ? 'esc back' : '']
          .filter(Boolean)
          .join(`  ${theme.glyphs.separator}  `)}
        fg="muted"
      />
    </Row>
  );
});

export interface ChatOptions {
  builtins?: boolean;
  /** The host. Omit for the scripted one, which is what the tests use. */
  host?: HostConnection & { pump?(): boolean };
}

export function registerChat(app: TextUIApp, options: ChatOptions = {}): Disposable {
  const bag = createBag();
  if (options.builtins !== false) bag.add(registerBuiltins(app));

  const host = options.host ?? fakeHost();
  const controller = createController(app, host);
  bag.add(controller);
  bag.add(app.services.provide(CONTROLLER, controller));

  for (const [component, render] of [
    ['ChatBubble', ChatBubble],
    ['StreamingText', StreamingText],
    ['ReasoningBlock', ReasoningBlock],
    ['ToolCallRow', ToolCallRow],
    ['ChatTranscript', ChatTranscript],
    ['ChatComposer', ChatComposer],
    ['ChatHitl', ChatHitl],
    ['SessionList', SessionList],
    ['ConnectionBadge', ConnectionBadge],
    ['ChangesList', ChangesList],
    ['SessionsScreen', SessionsScreen],
    ['ChatScreen', ChatScreen],
    ['NewSessionScreen', NewSessionScreen],
    ['ChangesScreen', ChangesScreen],
    ['SettingsScreen', SettingsScreen],
    ['HostsScreen', HostsScreen],
    ['ChatHeader', Header],
    ['ChatStatus', Status],
    ['ChatHints', Hints],
  ] as const) {
    bag.add(app.components.register({
      component,
      category: 'template',
      renderer: { kind: 'function', render: render as never },
    }));
  }

  bag.add(app.surfaces.open({ surface: 'header', key: 'title', target: { component: 'ChatHeader' } }));
  bag.add(app.surfaces.open({ surface: 'status', key: 'status', target: { component: 'ChatStatus' } }));

  for (const screen of [
    { id: 'sessions', component: 'SessionsScreen' },
    // Kept alive: coming back from the changes list to a conversation that
    // had scrolled itself back to the top is losing your place in a document
    // that is still being written.
    { id: 'chat', component: 'ChatScreen', keepAlive: true },
    { id: 'new', component: 'NewSessionScreen' },
    { id: 'changes', component: 'ChangesScreen' },
    { id: 'settings', component: 'SettingsScreen' },
    { id: 'hosts', component: 'HostsScreen' },
  ]) {
    bag.add(app.screens.register(screen));
  }

  void controller.refresh();
  app.screens.reset('sessions');
  return bag;
}

export { CONTROLLER } from './control.js';
