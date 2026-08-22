import {
  Badge, Button, Column, EmptyState, KeyValue, Panel, RadioGroup, Row, SearchBox,
  Select, TextArea, TextInput, defineComponent, useApp, useEffect, useFocusScope,
  useRequiredService, useState, useStore, useStoreSubtree, useStoreValue, useTheme,
} from '@textui/core';
import type { BindingPath, RenderOutput } from '@textui/core';
import { CHAT_SCOPE, CONTROLLER, SESSIONS_SCOPE } from './control.js';
import {
  ARCHIVED, CHANGES, DRAFT, EXPANDED, FILTER, HISTORY, HOST, INPUT, OPEN, QUEUE,
  SESSIONS, TURNS, openSession, visibleSessions, workspaceName,
} from './state.js';
import type { HostState } from './state.js';
import { toBlocks } from './blocks.js';
import type { Agent, Changeset, PendingInput, SessionConfig, Turn } from './ahp/types.js';
import { decodeStatus } from './ahp/status.js';
import { ChatTranscript } from './view/transcript.js';
import { ChatComposer } from './view/composer.js';
import { ChatHitl } from './view/hitl.js';
import { ChangesList } from './view/changes.js';
import { ConnectionBadge, SessionList } from './view/sessions.js';


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

const SELECTED = '$/chat/ui/selected' as BindingPath;

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

    const current = sessions.find((session) => session.resource === selected);
    const status = current ? decodeStatus(current.status) : null;
    const waiting = sessions.filter((session) => decodeStatus(session.status).activity === 'input').length;

    return (
      <Row flex={1} gap={1}>
        <Panel
          title="Sessions"
          flex={1}
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
            flex={1}
            onSelect={(uri: string) => app.store.set(SELECTED, uri)}
            onOpen={(uri: string) => { controller.open(uri); app.screens.push('chat'); }}
            emptyMessage={filter ? 'Nothing matches' : 'No sessions on this host'}
          />
          {!archived ? <text content="x  show archived" fg="subtle" /> : null}
        </Panel>

        <Panel title="Session" width={36}>
          {current && status ? (
            <Column gap={1} flex={1}>
              <text content={current.title} bold wrap="word" />
              <Row gap={1}>
                <text content={theme.glyphs[status.glyph]} fg={status.tone} />
                <text content={status.label} fg={status.tone} />
                {status.archived ? <Badge label="archived" tone="muted" /> : null}
              </Row>
              <KeyValue
                items={[
                  { label: 'Harness', value: current.provider },
                  { label: 'Workspace', value: workspaceName(current.workingDirectories[0]) },
                  { label: 'Started', value: current.createdAt.slice(0, 16).replace('T', ' ') },
                  { label: 'Session', value: current.resource },
                ]}
              />
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
            onEscape={() => app.focus.focus('chat.transcript')}
          />
        ) : null}

        <ChatComposer
          value={draft}
          running={running}
          queued={queued.length}
          meta={`${session.provider}  ${workspaceName(session.workingDirectories[0])}`}
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
          onStop={() => controller.stop()}
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
    const [agents, setAgents] = useState<Agent[]>([]);
    const [provider, setProvider] = useStore<string>('$/screen.new/provider' as BindingPath, 'claude');
    const [model, setModel] = useStore<string>('$/screen.new/model' as BindingPath, '');
    const [thinking, setThinking] = useStore<string>('$/screen.new/thinking' as BindingPath, 'medium');
    const [directory, setDirectory] = useStore<string>('$/screen.new/directory' as BindingPath, '/github/textui');
    const [first, setFirst] = useStore<string>('$/screen.new/first' as BindingPath, '');

    // What the host advertises, asked once. A real dispatch form asks
    // `resolveSessionConfig` again after every answer as well: the reply is
    // the whole property set for the selections passed in, and an answer can
    // bring new questions - a git workspace is what makes a host offer a
    // worktree, and taking the worktree is what makes it ask for a base branch.
    useEffect(() => { void controller.agents().then(setAgents); }, []);

    const agent = agents.find((found) => found.provider === provider);

    return (
      <Panel title="New session" flex={1}>
        <Column gap={1} flex={1}>
          <Select
            label="Harness"
            options={agents.map((found) => ({ value: found.provider, label: found.displayName }))}
            value={provider ?? 'claude'}
            onChange={(value: string) => setProvider(value)}
          />
          <Select
            label="Model"
            options={(agent?.models ?? []).map((found) => ({ value: found.id, label: found.displayName }))}
            value={model ?? ''}
            placeholder="the harness default"
            onChange={(value: string) => setModel(value)}
          />
          <RadioGroup
            label="Thinking"
            inline
            options={(agent?.models.find((m) => m.id === model)?.thinkingLevels ?? ['low', 'medium', 'high'])
              .map((level) => ({ value: level, label: level }))}
            value={thinking ?? 'medium'}
            onChange={(value: string) => setThinking(value)}
          />
          <TextInput
            label="Workspace"
            value={directory ?? ''}
            onChange={(value: string) => setDirectory(value)}
          />
          <text content="A session created with no workspace runs in the host's own directory, and an editor's agents window never shows it." fg="subtle" wrap="word" />

          <Panel title="First message" flex={1} border="single">
            <TextArea
              value={first ?? ''}
              onChange={(value: string) => setFirst(value)}
              maxRows={6}
              placeholder="What should it do?"
            />
          </Panel>

          <Row gap={2}>
            <Button
              label="Start"
              tone="success"
              variant="solid"
              disabled={(first ?? '').trim() === ''}
              onPress={() => {
                // The model rides on the first turn, not on `createSession`:
                // AHP hangs the selection on the message, so a session does
                // not have a model - each message does.
                void controller.create({
                  provider: provider ?? 'claude',
                  ...(directory ? { workingDirectory: directory } : {}),
                  first: first ?? '',
                }).then(() => {
                  setFirst('');
                  app.screens.replace('chat');
                });
              }}
            />
            <Button label="Cancel" variant="ghost" onPress={() => app.screens.pop()} />
          </Row>
        </Column>
      </Panel>
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
      void controller.config(uri).then(setConfig);
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
