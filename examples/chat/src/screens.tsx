import {
  Badge, Column, EmptyState, Panel, RadioGroup, Row, SearchBox,
  defineComponent, useApp, useEffect, useFocusScope,
  useRequiredService, useSize, useState, useStore, useStoreSubtree, useStoreValue, useTheme,
} from '@textui/core';
import type { BindingPath, RenderOutput, SemanticVariant } from '@textui/core';
import { CHAT_SCOPE, CONTROLLER, SESSIONS_SCOPE, settingCommand } from './control.js';
import {
  ARCHIVED, CHANGES, DRAFT, EXPANDED, FILTER, FOCUS, HISTORY, HOST, INPUT, MODEL, OPEN,
  PROVIDER, QUEUE, SELECTED, SESSIONS, SETTINGS, TURNS, WORKSPACE,
  openSession, visibleSessions, workspaceName,
} from './state.js';
import type { HostState } from './state.js';
import { toBlocks } from './blocks.js';
import type {
  Agent, Changeset, PendingInput, SessionConfig, SessionDetail, SessionSummary, Turn,
} from './ahp/types.js';
import { decodeStatus } from './ahp/status.js';
import { ChatTranscript } from './view/transcript.js';
import { ChatComposer } from './view/composer.js';
import { Creature } from './view/creature.js';
import { ChatHitl } from './view/hitl.js';
import { ChangesList } from './view/changes.js';
import { ConnectionBadge, SessionList } from './view/sessions.js';
import { SessionDetails } from './view/details.js';
import type { DetailField } from './view/details.js';
import { openPicker } from './view/picker.js';
import type { ComposerOption } from './view/controls.js';


/**
 * The screens.
 *
 * Six, and each is a different question: which conversation, the conversation
 * itself, starting one, what it changed, how it is configured, and which host
 * any of it is on. Anything else that came up - a tool call's full output, the
 * command palette, a confirm - is a layer or an expansion inside one of these,
 * because none of them is a place you navigate *to*.
 *
 * Every screen is composition. The parts are in `view/`, the actions are in
 * `control.ts`, and what is left here is which part goes where.
 */

/**
 * Everything the catalogue knows about one session, as rows.
 *
 * Two sources, and they are not interchangeable: the summary is what
 * `listSessions` returns and the detail is the session channel's own state -
 * the chat URI, the lifecycle and the settings in force are only ever on the
 * second. A pane that showed the summary alone could not answer "which chat is
 * this" or "what may it do without asking", which are the two questions
 * somebody reading a catalogue of agents actually has.
 */
function describe(session: SessionSummary, detail: SessionDetail | null): DetailField[] {
  const status = decodeStatus(session.status);
  const setting = (key: string): string => {
    const value = detail?.config.values[key];
    if (value === undefined) return '';
    // The host's own wording. `acceptEdits` is an id, "Accept edits" is what
    // the schema calls it, and the provider is the authority on both.
    const property = detail?.config.properties.find((found) => found.key === key);
    return property?.values.find((choice) => choice.value === value)?.label ?? value;
  };
  const changes = session.changes;

  return [
    { id: 'status', label: 'Status', value: status.label, tone: status.tone as SemanticVariant },
    { id: 'activity', label: 'Doing', value: session.activity ?? detail?.activity ?? '', absent: 'nothing it says' },
    { id: 'flags', label: 'Flags', value: [status.read ? 'read' : 'unread', status.archived ? 'archived' : ''].filter(Boolean).join(', ') },
    { id: 'provider', label: 'Harness', value: session.provider },
    { id: 'model', label: 'Model', value: detail?.model ?? '', absent: 'nothing said yet' },
    // The host's own questions, in the host's own order. Naming them here is
    // how the pane came to show a blank "Permissions" against a host whose key
    // for it is `autoApprove`.
    ...(detail?.config.properties ?? [])
      .filter((property) => property.values.length > 0)
      .map((property) => ({
        id: `config.${property.key}`,
        label: property.title,
        value: setting(property.key),
      })),
    { id: 'workspace', label: 'Workspace', value: session.workingDirectories.map((dir) => dir.replace(/^file:\/\//, '')).join(', '), absent: 'the host\'s own directory' },
    // The identifiers, in full and copyable. A URI you can read half of is
    // worse than one you cannot see at all: it looks like the whole thing.
    { id: 'session', label: 'Session', value: session.resource },
    { id: 'chat', label: 'Chat', value: detail?.chat ?? '', absent: 'no chat yet' },
    // What the host said when it would not answer. `-32001 No agent for
    // session` is a live catalogue listing something whose agent has exited:
    // the row is real, and everything on the session channel is not there.
    { id: 'lifecycle', label: 'Lifecycle', value: detail?.refusal ?? detail?.lifecycle ?? '', ...(detail?.refusal ? { tone: 'danger' as SemanticVariant } : {}) },
    { id: 'created', label: 'Started', value: session.createdAt.slice(0, 16).replace('T', ' ') },
    { id: 'modified', label: 'Updated', value: session.modifiedAt.slice(0, 16).replace('T', ' ') },
    {
      id: 'changes',
      label: 'Changes',
      value: changes?.files
        ? `${changes.files} files  +${changes.additions ?? 0} -${changes.deletions ?? 0}`
        : '',
      absent: 'nothing yet',
    },
  ];
}

// ---------------------------------------------------------------- 1. sessions

export const SessionsScreen: (props: Record<string, never>) => RenderOutput =
  defineComponent<Record<string, never>>('SessionsScreen', () => {
    const app = useApp();
    const theme = useTheme();
    const controller = useRequiredService(CONTROLLER);
    // While this is mounted, `n` `r` `a` `x` `d` mean what the catalogue means
    // by them. On the conversation screen they do not exist.
    useFocusScope({ id: SESSIONS_SCOPE });

    useStoreSubtree(SESSIONS);
    const filter = useStoreValue<string>(FILTER, '') ?? '';
    const archived = useStoreValue<boolean>(ARCHIVED, false) ?? false;
    const selected = useStoreValue<string | null>(SELECTED, null) ?? null;
    const sessions = visibleSessions(app.store);
    const host = useStoreValue<HostState>(HOST);

    // A list with a highlight and nothing selected is a detail panel that is
    // empty until a key is pressed.
    const ids = sessions.map((session) => session.resource).join(',');
    useEffect(() => {
      if (sessions.length === 0) return;
      if (selected && sessions.some((session) => session.resource === selected)) return;
      app.store.set(SELECTED, sessions[0]?.resource ?? null);
    }, [ids]);

    /**
     * The pane with the keyboard is the wide one.
     *
     * A fixed split has to be wrong somewhere: forty cells for the detail pane
     * left a session list too narrow to read a title in, and widening the list
     * would truncate the URIs the detail pane exists to let you copy. Neither
     * of those is a problem while you are looking at the *other* one, so the
     * space follows the reader - and walking out of the details with tab or
     * escape gives the list its width back on the way past.
     */
    const focused = useStoreValue<string | null>(FOCUS, null);
    const reading = focused === 'chat.details';
    const aside = Math.max(34, Math.min(56, Math.round(useSize().width * 0.4)));
    // What the pane without the keyboard keeps: two fifths, and never less
    // than a session title fits in. Capped as the terminal grows, because the
    // pane being read has a use for the rest and this one does not.

    const current = sessions.find((session) => session.resource === selected);
    const status = current ? decodeStatus(current.status) : null;
    const waiting = sessions.filter((session) => decodeStatus(session.status).activity === 'input').length;

    // The channel's own state, asked for one session at a time. Asking for
    // every row would be a round trip per row on a screen that already has
    // everything a row needs.
    const [detail, setDetail] = useState<SessionDetail | null>(null);
    useEffect(() => {
      setDetail(null);
      if (!selected) return;
      let live = true;
      // Caught, not `void`ed. A live catalogue lists sessions whose agent has
      // gone, the host refuses to talk about them, and an unhandled rejection
      // from a highlight moving is an application that exits when you press a
      // down arrow.
      void controller.detail(selected)
        .then((found) => { if (live) setDetail(found); })
        .catch((error: unknown) => controller.report(error));
      return () => { live = false; };
    }, [selected ?? '']);

    return (
      <Row flex={1} gap={1}>
        <Panel
          title="Sessions"
          {...(reading ? { width: aside } : { flex: 1 })}
          meta={waiting > 0 ? `${theme.glyphs.warning} ${waiting} waiting on you` : `${sessions.length} shown`}
        >
          <SearchBox
            value={filter}
            placeholder="title, provider or workspace"
            // Named, so `/` has something to focus. A control whose id comes
            // from its instance cannot be the target of a command.
            focusId="chat.filter"
            onChange={(value: string) => app.store.set(FILTER, value)}
          />
          <SessionList
            sessions={sessions}
            selectedId={selected}
            focusId="chat.sessions"
            // The list, not the filter. Whatever registers first would
            // otherwise hold the keyboard on arrival, and the filter is drawn
            // above the list - which made every single-letter command a letter
            // typed into a text field. `n`, `a` and `d` did nothing at all,
            // which is not what a missing key looks like from the outside.
            autoFocus
            flex={1}
            onSelect={(uri: string) => app.store.set(SELECTED, uri)}
            onOpen={(uri: string) => { controller.open(uri); app.screens.push('chat'); }}
            emptyMessage={filter ? 'Nothing matches' : 'No sessions on this host'}
          />
          {!archived ? <text content="x  show archived" fg="subtle" /> : null}
        </Panel>

        <Panel
          title="Session"
          {...(reading ? { flex: 1 } : { width: aside })}
          meta={current ? 'enter copies' : ''}
        >
          {current && status ? (
            <Column gap={1} flex={1}>
              <Row gap={1}>
                <text content={theme.glyphs[status.glyph]} fg={status.tone} />
                <text content={current.title} bold wrap="word" flex={1} />
                {status.archived ? <Badge label="archived" tone="muted" /> : null}
              </Row>
              {/* Tab reaches this, arrows walk it, enter copies the row. The
                  identifiers are the reason: they are what gets pasted into a
                  shell, and they are exactly what does not fit on one line. */}
              <SessionDetails fields={describe(current, detail)} focusId="chat.details" />
              <text content="" flex={1} />
              <ConnectionBadge
                url={host?.url ?? ''}
                state={host?.state ?? 'offline'}
                sessions={sessions.length}
              />
            </Column>
          ) : (
            <EmptyState title="Nothing selected" message="Choose a session on the left." />
          )}
        </Panel>
      </Row>
    );
  });

/**
 * The composer's control row, for whichever session it is above.
 *
 * Two of these are the client's own questions - which harness, which model -
 * because the protocol asks them itself. Everything after them is the host's:
 * one chip per property its schema offers, in its order, with its titles. The
 * row used to name `permissionMode`, which is what the *fixture* calls its
 * key, so against a real host - whose keys are `isolation`, `autoApprove` and
 * `mode` - it showed one chip that could answer nothing.
 *
 * Labels, never ids. `acceptEdits` is what the host stores and "Accept edits"
 * is what it calls it, and the schema is the authority on both - so a chip
 * reads as a sentence about what will happen rather than as a config value.
 */
function useComposerOptions(): ComposerOption[] {
  const theme = useTheme();
  const controller = useRequiredService(CONTROLLER);
  const open = useStoreValue<string | null>(OPEN, null) ?? null;
  const provider = useStoreValue<string>(PROVIDER, 'claude') ?? 'claude';
  const model = useStoreValue<string>(MODEL, '') ?? '';
  const settings = useStoreValue<Record<string, string>>(SETTINGS, {}) ?? {};
  const workspace = useStoreValue<string>(WORKSPACE, '') ?? '';

  const [agents, setAgents] = useState<Agent[]>([]);
  const [config, setConfig] = useState<SessionConfig | null>(null);
  useEffect(() => {
    void controller.agents().then(setAgents).catch((error: unknown) => controller.report(error));
  }, []);
  // Asking is also what registers a command per property, so the chips below
  // have something to open and the palette has the same questions in it.
  useEffect(() => {
    void controller.settings().then(setConfig)
      .catch((error: unknown) => controller.report(error));
  }, [provider, open]);

  const agent = agents.find((found) => found.provider === provider);
  // A harness with no models is the ordinary answer for one nobody has signed
  // into, so the chip says so rather than opening on an empty list. Until the
  // catalogue has arrived there is no harness to say it about.
  const models = agent ? agent.models : null;

  return [
    {
      id: 'harness',
      icon: theme.glyphs.bulletFilled,
      label: agent?.displayName ?? provider,
      // Fixed once the session exists: it is the process the conversation is
      // running in.
      ...(open ? {} : { commandId: 'compose.harness' }),
    },
    {
      id: 'model',
      icon: theme.glyphs.bulletHollow,
      label: models?.find((found) => found.id === model)?.displayName
        ?? (model || (models !== null && models.length === 0 ? 'no models' : 'default')),
      ...(models !== null && models.length === 0 ? {} : { commandId: 'compose.model' }),
    },
    ...(config?.properties ?? [])
      .filter((property) => property.values.length > 0)
      .map((property): ComposerOption => {
        const value = settings[property.key];
        return {
          id: property.key,
          label: property.values.find((found) => found.value === value)?.label
            ?? value ?? property.title,
          // Shown but not asked where the host says it cannot be changed on a
          // running session: offering it produces a refusal, not an edit.
          ...(open && !property.sessionMutable ? {} : { commandId: settingCommand(property.key) }),
        };
      }),
    {
      id: 'workspace',
      icon: theme.glyphs.breadcrumb,
      label: workspaceName(workspace ? `file://${workspace}` : undefined),
      ...(open ? {} : { commandId: 'compose.workspace' }),
    },
  ];
}

// -------------------------------------------------------------------- 2. chat

export const ChatScreen: (props: Record<string, never>) => RenderOutput =
  defineComponent<Record<string, never>>('ChatScreen', () => {
    const app = useApp();
    const controller = useRequiredService(CONTROLLER);
    useFocusScope({ id: CHAT_SCOPE });

    const turns = useStoreValue<Turn[]>(TURNS, []) ?? [];
    const input = useStoreValue<PendingInput | null>(INPUT, null) ?? null;
    const queued = useStoreValue<string[]>(QUEUE, []) ?? [];
    const draft = useStoreValue<string>(DRAFT, '') ?? '';
    const expanded = useStoreValue<Record<string, boolean>>(EXPANDED, {}) ?? {};
    const history = useStoreValue<string[]>(HISTORY, []) ?? [];
    const [recall, setRecall] = useState(history.length);
    // The cursor is state like everything else, and it lives in the screen's
    // own scope - so it survives a trip to the changes list, which is
    // `keepAlive`, and dies with the screen, which is what a scope is for.
    const [cursor, setCursor] = useStore<number>('$/screen.chat/cursor' as BindingPath, 0);

    const session = openSession(app.store);
    const running = turns.some((turn) => turn.state === 'running');
    const blocks = toBlocks(turns, queued);
    const options = useComposerOptions();

    if (!session) {
      return <EmptyState title="No session open" message="Open one from the catalogue." flex={1} />;
    }

    return (
      <Column flex={1} gap={1}>
        <ChatTranscript
          flex={1}
          blocks={blocks}
          expanded={expanded}
          cursor={cursor ?? 0}
          onCursor={setCursor}
          onToggle={(id: string) => app.store.set(EXPANDED, { ...expanded, [id]: !expanded[id] })}
        />

        {/* The block that is waiting on a person sits between the conversation
            and the composer, where it cannot scroll away and cannot be typed
            past. */}
        {input ? (
          <ChatHitl
            input={input}
            onApprove={(option?: string) => controller.approve(option)}
            onDeny={() => controller.deny()}
            onAnswer={(answers, accepted) => controller.answer(answers, accepted)}
            // The block takes keys globally while it is up, escape included -
            // which is right for `a` and `d` and wrong for the one key that is
            // how you leave. Sent back to the transcript unconditionally it
            // read as "escape does nothing", and a session blocked on a
            // confirmation could not be left without answering it. So escape
            // leaves whatever it is in: the block first, then the screen.
            onEscape={() => {
              if (app.focus.focused() === 'chat.transcript') app.screens.pop();
              else app.focus.focus('chat.transcript');
            }}
          />
        ) : null}

        <ChatComposer
          value={draft}
          running={running}
          queued={queued.length}
          options={options}
          onOption={(option, anchorId) => {
            if (option.commandId) openPicker(app, { commandId: option.commandId, anchorId });
          }}
          commands={app.commands.list({ slot: 'palette', enabledOnly: true })
            .map((command) => ({ id: command.id, title: command.title, ...(command.description ? { description: command.description } : {}) }))}
          onChange={(value: string) => app.store.set(DRAFT, value)}
          onSubmit={(value: string) => { controller.send(value); setRecall(history.length + 1); }}
          onCancel={() => app.focus.focus('chat.transcript')}
          onHistory={(direction: -1 | 1) => {
            // Up at the top of an empty draft is the last thing you sent. It
            // is the fastest correction there is, and every other client has it.
            const next = Math.max(0, Math.min(history.length, recall + direction));
            setRecall(next);
            app.store.set(DRAFT, history[next] ?? '');
          }}
          onLeave={() => app.focus.focus('chat.transcript')}
          autoFocus={!input}
        />
      </Column>
    );
  });

// --------------------------------------------------------------- 3. new session

export const NewSessionScreen: (props: Record<string, never>) => RenderOutput =
  defineComponent<Record<string, never>>('NewSessionScreen', () => {
    const app = useApp();
    const controller = useRequiredService(CONTROLLER);
    const theme = useTheme();

    const draft = useStoreValue<string>(DRAFT, '') ?? '';
    const history = useStoreValue<string[]>(HISTORY, []) ?? [];
    const [recall, setRecall] = useState(history.length);
    const options = useComposerOptions();

    return (
      <Column flex={1} gap={1}>
        {/* Nothing has been said, so there is nothing to draw above the field.
            What fills the space is the invitation, and it stays out of the way
            of the one control that matters. */}
        <Column flex={1} justify="center" align="center" gap={0}>
          {/* One of six, picked when the screen mounts. Only here: an empty
              screen is the one place a client can afford a figure, and every
              other screen has a conversation to show instead. */}
          <Creature mood="happy" margin={[0, 0, 1, 0]} />
          <text content="A new session" fg="muted" />
          <text content="The first message is what starts it." fg="subtle" />
          <text content={`${theme.glyphs.chevronLeft} esc for the sessions you already have`} fg="subtle" />
        </Column>

        <ChatComposer
          value={draft}
          options={options}
          onOption={(option, anchorId) => {
            if (option.commandId) openPicker(app, { commandId: option.commandId, anchorId });
          }}
          commands={app.commands.list({ slot: 'palette', enabledOnly: true })
            .map((command) => ({ id: command.id, title: command.title, ...(command.description ? { description: command.description } : {}) }))}
          onChange={(value: string) => app.store.set(DRAFT, value)}
          // The message *is* the session. Nothing is created until there is
          // something to say, which is why there is no Start button to leave
          // pressed by mistake - and why the provider being lazy costs nothing:
          // it does not attach until there is a turn to run, and this is one.
          onSubmit={(value: string) => {
            const first = value.trim();
            if (!first) return;
            setRecall(history.length + 1);
            const workspace = app.store.get<string>(WORKSPACE) ?? '';
            void controller.create({
              provider: app.store.get<string>(PROVIDER) ?? 'claude',
              ...(workspace ? { workingDirectory: workspace } : {}),
              first,
            })
              .then(() => app.screens.push('chat'))
              // Stay here. A host that refused to create the session has left
              // nothing to navigate to, and the draft is still in the field.
              .catch((error: unknown) => controller.report(error));
          }}
          onCancel={() => app.execute('go.sessions')}
          // Left off the front of the field, twice over, is the same thought as
          // escape: out of here, back to what already exists.
          onLeave={() => app.execute('go.sessions')}
          onHistory={(direction: -1 | 1) => {
            const next = Math.max(0, Math.min(history.length, recall + direction));
            setRecall(next);
            app.store.set(DRAFT, history[next] ?? '');
          }}
          autoFocus
        />
      </Column>
    );
  });

// ----------------------------------------------------------------- 4. changes

export const ChangesScreen: (props: Record<string, never>) => RenderOutput =
  defineComponent<Record<string, never>>('ChangesScreen', () => {
    const app = useApp();
    const changes = useStoreValue<Changeset>(CHANGES, { status: 'complete', files: [] });
    const session = openSession(app.store);

    return (
      <Panel title={`Changes ${session ? `- ${session.title}` : ''}`} flex={1}>
        <ChangesList changes={changes ?? { status: 'complete', files: [] }} flex={1} />
      </Panel>
    );
  });

// ---------------------------------------------------------------- 5. settings

export const SettingsScreen: (props: Record<string, never>) => RenderOutput =
  defineComponent<Record<string, never>>('SettingsScreen', () => {
    const controller = useRequiredService(CONTROLLER);
    const uri = useStoreValue<string>(OPEN, '');
    const [config, setConfig] = useState<SessionConfig | null>(null);

    useEffect(() => {
      if (!uri) return;
      void controller.config(uri).then(setConfig)
        .catch((error: unknown) => controller.report(error));
    }, [uri ?? '']);

    if (!config) return <EmptyState title="Reading the session" flex={1} />;

    return (
      <Panel title="Session settings" flex={1}>
        <Column gap={1} flex={1}>
          {config.properties.map((property) => (
            <Column key={property.key} gap={0}>
              <Row gap={1}>
                <text content={property.title} bold />
                {!property.sessionMutable ? <text content="fixed for this session" fg="subtle" /> : null}
              </Row>
              {property.description ? <text content={property.description} fg="muted" wrap="word" /> : null}
              <RadioGroup
                options={property.values.map((value) => ({ value: value.value, label: value.label }))}
                value={config.values[property.key] ?? ''}
                disabled={!property.sessionMutable}
                onChange={(value: string) => {
                  if (!uri) return;
                  controller.setConfig(uri, property.key, value);
                  setConfig({ ...config, values: { ...config.values, [property.key]: value } });
                }}
              />
            </Column>
          ))}
          <text content="" flex={1} />
          <text
            content="Only what the schema marks changeable on a running session is offered. The action merges one key - sending the whole object writes back what another client just changed."
            fg="subtle"
            wrap="word"
          />
        </Column>
      </Panel>
    );
  });

// ------------------------------------------------------------------- 6. hosts

export const HostsScreen: (props: Record<string, never>) => RenderOutput =
  defineComponent<Record<string, never>>('HostsScreen', () => {
    const app = useApp();
    const host = useStoreValue<HostState>(HOST);
    const [agents, setAgents] = useState<Agent[]>([]);

    useEffect(() => {
      void app.services.require(CONTROLLER).agents().then(setAgents);
    }, []);

    return (
      <Panel title="Hosts" flex={1}>
        <Column gap={1} flex={1}>
          <ConnectionBadge url={host?.url ?? ''} state={host?.state ?? 'offline'} />
          <text content="An agent host is a sessions server. Several clients watch and drive the same sessions; none of them owns the process running the agent." fg="muted" wrap="word" />
          {/* Which of the two is answering, and how to ask for the other. The
              seam is one interface, so this is the only screen that has any
              reason to mention that there are two implementations of it. */}
          {host?.id === 'fake' ? (
            <text
              content="This is the scripted host: five seeded sessions and an agent that answers four ways. Start with --host ws://… to drive a real one instead."
              fg="subtle"
              wrap="word"
            />
          ) : (
            <text
              content="A live host. What it says is what it sent."
              fg="subtle"
              wrap="word"
            />
          )}
          {agents.map((agent) => (
            <Column key={agent.provider} gap={0}>
              <Row gap={1}>
                <text content={agent.displayName} bold />
                <Badge label={agent.provider} tone="muted" />
              </Row>
              {agent.description ? <text content={agent.description} fg="muted" /> : null}
              {agent.models.map((model) => (
                <text key={model.id} content={`  ${model.displayName}  (${model.id})`} fg="subtle" />
              ))}
            </Column>
          ))}
        </Column>
      </Panel>
    );
  });
