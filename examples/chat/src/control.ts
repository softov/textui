import { confirm, createBag, serviceKey } from '@textui/core';
import type { CommandDefinition, Disposable, ServiceKey, TextUIApp } from '@textui/core';
import type { HostConnection } from './ahp/connection.js';
import type { Agent, Answer, SessionConfig, SessionUri, Turn } from './ahp/types.js';
import {
  ARCHIVED, DRAFT, EXPANDED, FILTER, HOST, INPUT, OPEN, QUEUE, STATUS, TURNS,
  applyEvent, pendingInput, queue, turns, visibleSessions, writeSessions,
} from './state.js';

/**
 * The control side: what the application can do, and what it does when the
 * host says something.
 *
 * Split from the views because these are the two things that change for
 * different reasons. A new screen is a rendering change; answering a new kind
 * of request is a change here. Keeping them in one file is what makes a small
 * protocol change touch every component that draws a bubble.
 *
 * Everything a key can do is a command, so the palette gets it for free and
 * nothing is reachable one way only.
 */

export interface Controller {
  refresh(): Promise<void>;
  open(uri: SessionUri): void;
  close(): void;
  /** Send, or queue when a turn is already running. */
  send(text: string): void;
  stop(): void;
  approve(optionId?: string): void;
  deny(): void;
  answer(answers: Record<string, Answer>, accepted?: boolean): void;
  setArchived(uri: SessionUri, archived: boolean): void;
  dispose(uri: SessionUri): Promise<void>;
  create(options: { provider: string; workingDirectory?: string; first?: string }): Promise<SessionUri>;
  /** The harnesses this host advertises, and the models each offers. */
  agents(): Promise<Agent[]>;
  config(uri: SessionUri): Promise<SessionConfig>;
  setConfig(uri: SessionUri, key: string, value: string): void;
  /** Drive the scripted host. A real connection has a socket instead. */
  pump(): boolean;
}

export const CONTROLLER: ServiceKey<Controller> = serviceKey<Controller>('chat.controller');

/**
 * The two focus scopes, and why single-letter keys need them.
 *
 * The runtime already offers a key to the focused node before any keybinding,
 * so `q` typed into the composer is a letter and not a quit. What a scope adds
 * is *where a key exists at all*: `d` disposes a session on the catalogue and
 * means nothing in a conversation, and a binding that exists on both screens
 * is one that fires on the wrong one.
 *
 * A scope is active while the component that declares it is mounted, so the
 * screens are what turn these on and off.
 */
export const SESSIONS_SCOPE = 'chat.sessions';
export const CHAT_SCOPE = 'chat.conversation';

export function createController(
  app: TextUIApp,
  host: HostConnection & { pump?(): boolean },
): Controller & Disposable {
  const bag = createBag();
  // The client's own copy of the conversation, kept so a delta can be applied
  // to the part it names rather than the store being read back and rewritten.
  let model: Turn[] = [];
  let subscription: { close(): void } | null = null;

  app.store.set(HOST, { id: host.id, url: host.url, state: host.state() });
  app.store.set(FILTER, '');
  app.store.set(ARCHIVED, false);
  app.store.set(EXPANDED, {});
  app.store.set(QUEUE, []);
  app.store.set(DRAFT, '');

  const controller: Controller = {
    async refresh() {
      writeSessions(app.store, await host.listSessions());
    },

    open(uri) {
      // Closing drops this consumer only. Unsubscribing the channel to shed a
      // duplicate is what silently kills the stream everything else reads.
      subscription?.close();
      model = [];
      app.store.set(OPEN, uri);
      app.store.set(TURNS, []);
      app.store.set(INPUT, null);
      subscription = host.subscribe(uri, (event) => {
        model = applyEvent(app.store, event, model);
        if (event.type === 'status') void controller.refresh();
      });
    },

    close() {
      subscription?.close();
      subscription = null;
      app.store.set(OPEN, null);
      app.store.set(TURNS, []);
      app.store.set(INPUT, null);
      // Idle, because nothing is open. A status that outlived the conversation
      // it described is a header saying "running" over an empty screen.
      app.store.set(STATUS, 1);
    },

    send(text) {
      const uri = app.store.get<SessionUri>(OPEN);
      const trimmed = text.trim();
      if (!uri || trimmed === '') return;

      app.store.set(DRAFT, '');
      const history = app.store.get<string[]>('$/chat/ui/history') ?? [];
      app.store.set('$/chat/ui/history', [...history, trimmed]);

      // A turn is already running: this is a queued message, not a second
      // turn. Sending it anyway is how two turns end up interleaved in one
      // chat, and the host is not the thing that stops you.
      if (turns(app.store).some((turn) => turn.state === 'running')) {
        app.store.set(QUEUE, [...queue(app.store), trimmed]);
        return;
      }
      host.say(uri, trimmed);
    },

    stop() {
      const uri = app.store.get<SessionUri>(OPEN);
      if (uri) host.stopTurn(uri);
    },

    approve(optionId) {
      const uri = app.store.get<SessionUri>(OPEN);
      const input = pendingInput(app.store);
      if (!uri || input?.kind !== 'toolConfirmation') return;
      host.confirmToolCall(uri, input.call.id, true, optionId);
    },

    deny() {
      const uri = app.store.get<SessionUri>(OPEN);
      const input = pendingInput(app.store);
      if (!uri || input?.kind !== 'toolConfirmation') return;
      host.confirmToolCall(uri, input.call.id, false);
    },

    answer(answers, accepted = true) {
      const uri = app.store.get<SessionUri>(OPEN);
      const input = pendingInput(app.store);
      if (!uri || input?.kind !== 'chatInput') return;
      // An accept with no answers resumes the agent on the answers it already
      // had, which for a question it has just asked is none.
      const missing = input.questions.filter((q) => q.required && !answers[q.id]);
      if (accepted && missing.length > 0) return;
      host.completeInput(uri, input.id, accepted, answers);
    },

    setArchived(uri, archived) {
      host.setArchived(uri, archived);
      void controller.refresh();
    },

    async dispose(uri) {
      await host.disposeSession(uri);
      if (app.store.get<SessionUri>(OPEN) === uri) controller.close();
      await controller.refresh();
    },

    async create({ provider, workingDirectory, first }) {
      const uri = await host.createSession({ provider, ...(workingDirectory ? { workingDirectory } : {}) });
      await controller.refresh();
      controller.open(uri);
      // The provider is lazy: a session sits in `creating` and emits nothing
      // until there is a turn to run, so waiting for `ready` before the first
      // dispatch is a deadlock - the dispatch is what causes it.
      if (first) controller.send(first);
      return uri;
    },

    agents: () => host.agents(),
    config: (uri) => host.config(uri),
    setConfig: (uri, key, value) => host.setConfig(uri, key, value),

    pump: () => host.pump?.() ?? false,
  };

  bag.add({ dispose: () => subscription?.close() });
  for (const command of commands(app, controller)) bag.add(app.commands.register(command));
  for (const binding of keys()) bag.add(app.keybindings.register(binding));

  return Object.assign(controller, { dispose: () => bag.dispose() });
}

// ------------------------------------------------------------------- commands

function commands(app: TextUIApp, controller: Controller): CommandDefinition[] {
  const selected = (): SessionUri | null => app.store.get<SessionUri>('$/chat/ui/selected') ?? null;
  const openUri = (): SessionUri | null => app.store.get<SessionUri>(OPEN) ?? null;
  const running = (): boolean => turns(app.store).some((turn) => turn.state === 'running');

  return [
    {
      id: 'app.palette',
      title: 'Command Palette',
      category: 'Go',
      slots: [],
      run: () => {
        app.layers.open({
          id: 'palette',
          layer: 'modal',
          scrim: true,
          trapFocus: true,
          dismissOnEscape: true,
          node: {
            component: 'CommandPalette',
            width: 62,
            commands: app.commands.list({ slot: 'palette', enabledOnly: true }),
            onClose: { handler: () => app.layers.close('palette') },
          },
        });
      },
    },
    { id: 'go.back', title: 'Back', category: 'Go', slots: ['palette'], run: () => { app.screens.pop(); } },
    {
      id: 'go.sessions',
      title: 'Sessions',
      category: 'Go',
      slots: ['palette'],
      run: () => { app.screens.reset('sessions'); void controller.refresh(); },
    },
    {
      id: 'go.changes',
      title: 'What this session changed',
      category: 'Go',
      slots: ['palette'],
      when: `${OPEN}`,
      run: () => app.screens.push('changes'),
    },
    {
      id: 'go.settings',
      title: 'Session settings',
      category: 'Go',
      slots: ['palette'],
      when: `${OPEN}`,
      run: () => app.screens.push('settings'),
    },
    { id: 'go.hosts', title: 'Hosts', category: 'Go', slots: ['palette'], run: () => app.screens.push('hosts') },

    {
      id: 'session.open',
      title: 'Open session',
      category: 'Session',
      slots: ['palette'],
      run: (args: Record<string, unknown>) => {
        const uri = (typeof args.uri === 'string' ? args.uri : null) ?? selected();
        if (!uri) return;
        controller.open(uri);
        app.screens.push('chat');
      },
      args: [{ name: 'uri', type: 'string' as const }],
    },
    {
      id: 'session.new',
      title: 'New session',
      category: 'Session',
      slots: ['palette'],
      run: () => app.screens.push('new'),
    },
    {
      id: 'session.refresh',
      title: 'Refresh the catalogue',
      category: 'Session',
      slots: ['palette'],
      keepOpen: true,
      run: () => void controller.refresh(),
    },
    {
      id: 'session.archive',
      title: 'Archive / unarchive',
      category: 'Session',
      slots: ['palette'],
      run: () => {
        const uri = selected() ?? openUri();
        const session = visibleSessions(app.store).find((s) => s.resource === uri)
          ?? (uri ? { resource: uri, status: 0 } : null);
        if (!uri || !session) return;
        controller.setArchived(uri, (session.status & 64) === 0);
      },
    },
    {
      id: 'session.dispose',
      title: 'Dispose session',
      category: 'Session',
      slots: ['palette'],
      run: async () => {
        const uri = selected() ?? openUri();
        if (!uri) return;
        // The host frees the session and tells every other client. Ending
        // somebody else's conversation is not an undo, so it is asked for.
        const yes = await confirm(app.layers, {
          title: 'Dispose session',
          message: 'The host ends this session for every client watching it. The record of what happened stays.',
          confirmLabel: 'Dispose',
          cancelLabel: 'Keep',
          tone: 'danger',
        });
        if (yes) await controller.dispose(uri);
      },
    },
    {
      id: 'session.toggleArchived',
      title: 'Show archived sessions',
      category: 'Session',
      slots: ['palette'],
      keepOpen: true,
      run: () => app.store.set(ARCHIVED, !(app.store.get<boolean>(ARCHIVED) ?? false)),
    },

    {
      id: 'chat.stop',
      title: 'Stop the turn',
      category: 'Chat',
      slots: ['palette'],
      // Both halves matter. Without the open session, a status left behind by
      // the last conversation makes `ctrl+c` "stop" something nobody is
      // looking at - and, because the binding matched, it never falls through
      // to the one that closes the application.
      when: `${OPEN} && ${STATUS} > 1`,
      run: () => controller.stop(),
    },
    {
      id: 'chat.approve',
      title: 'Approve what the agent is waiting on',
      category: 'Chat',
      slots: ['palette'],
      run: (args: Record<string, unknown>) => controller.approve(typeof args.option === 'string' ? args.option : undefined),
      args: [{ name: 'option', type: 'string' as const }],
    },
    { id: 'chat.deny', title: 'Deny it', category: 'Chat', slots: ['palette'], run: () => controller.deny() },
    {
      id: 'chat.send',
      title: 'Send a message',
      category: 'Chat',
      slots: ['palette'],
      args: [{ name: 'text', type: 'string' as const, required: true, description: 'What to say' }],
      run: (args: Record<string, unknown>) => controller.send(String(args.text ?? '')),
    },
    {
      id: 'chat.focusComposer',
      title: 'Write a message',
      category: 'Chat',
      slots: ['palette'],
      run: () => app.focus.focus('chat.composer'),
    },
    {
      id: 'session.filter',
      title: 'Filter the catalogue',
      category: 'Session',
      slots: ['palette'],
      run: () => app.focus.focus('chat.filter'),
    },
    {
      id: 'chat.focusTranscript',
      title: 'Read the transcript',
      category: 'Chat',
      slots: ['palette'],
      run: () => app.focus.focus('chat.transcript'),
    },
    {
      id: 'chat.clearQueue',
      title: 'Drop queued messages',
      category: 'Chat',
      slots: ['palette'],
      when: `${QUEUE}`,
      run: () => app.store.set(QUEUE, []),
    },
    {
      id: 'chat.expand',
      title: 'Expand / collapse the selected block',
      category: 'Chat',
      slots: [],
      run: (args: Record<string, unknown>) => {
        const id = String(args.id ?? '');
        if (!id) return;
        const expanded = app.store.get<Record<string, boolean>>(EXPANDED) ?? {};
        app.store.set(EXPANDED, { ...expanded, [id]: !expanded[id] });
      },
      args: [{ name: 'id', type: 'string' as const }],
    },
    {
      id: 'chat.running',
      title: 'Is a turn running',
      category: 'Chat',
      slots: [],
      run: () => running(),
    },
  ];
}

// ----------------------------------------------------------------------- keys

/**
 * What the keyboard does, and where.
 *
 * Two tiers, and the split is not cosmetic. Modified keys are global because
 * nothing types them. Single letters are registered against the transcript's
 * focus scope, because while the composer has focus they are letters.
 */
function keys(): { keys: string; commandId: string; scopeId?: string; args?: Record<string, unknown> }[] {
  return [
    // Global: nothing types these, so they are safe wherever focus is.
    { keys: 'ctrl+p', commandId: 'app.palette' },
    // Stop what is running. When nothing is, this does not match and the key
    // falls through to whatever the host bound it to - which is how `ctrl+c`
    // ends up meaning "cancel this, or leave" the way it does everywhere else.
    { keys: 'ctrl+c', commandId: 'chat.stop' },
    { keys: 'ctrl+n', commandId: 'session.new' },
    { keys: 'ctrl+r', commandId: 'session.refresh' },
    { keys: 'escape', commandId: 'go.back' },

    // The catalogue.
    { keys: 'n', commandId: 'session.new', scopeId: SESSIONS_SCOPE },
    { keys: 'r', commandId: 'session.refresh', scopeId: SESSIONS_SCOPE },
    { keys: 'a', commandId: 'session.archive', scopeId: SESSIONS_SCOPE },
    { keys: 'x', commandId: 'session.toggleArchived', scopeId: SESSIONS_SCOPE },
    { keys: 'd', commandId: 'session.dispose', scopeId: SESSIONS_SCOPE },
    { keys: '/', commandId: 'session.filter', scopeId: SESSIONS_SCOPE },

    // The conversation. `i` is the one that gets you into the composer, and
    // out of it is escape - the pair that makes every other letter reachable.
    { keys: 'c', commandId: 'go.changes', scopeId: CHAT_SCOPE },
    { keys: 's', commandId: 'go.settings', scopeId: CHAT_SCOPE },
    { keys: 't', commandId: 'chat.stop', scopeId: CHAT_SCOPE },
  ];
}
