import { randomUUID } from 'node:crypto';
import type { HostConnection, HostEvent } from './connection.js';
import type {
  Agent, Answer, Changeset, ConfigProperty, FileEdit, PendingInput, Question, QuestionKind,
  ResponsePart, SessionConfig, SessionDetail, SessionSummary, SessionUri, ToolCall,
  ToolCallStatus, Turn,
} from './types.js';

/**
 * The other implementation of the seam: a real agent host, over a WebSocket.
 *
 * `fakeHost` is a script and this is a socket, and nothing above either of them
 * can tell which is which - that is what `HostConnection` is for. Point it at a
 * host with `--host ws://…` and the same screens drive somebody's editor.
 *
 * **Reducers are the host's, not ours.** The protocol ships a client library
 * with the transport, the subscription fan-out and a generated reducer per
 * channel, and reimplementing eighty typed mutations here would be inventing a
 * second answer to "what is the state now". So the package is loaded at
 * runtime and everything below is translation: its state shapes into the
 * flattened ones in `types.ts`, and back out as the actions a client is
 * allowed to dispatch.
 *
 * It is an **optional** dependency, because the example has to run, and be
 * checked, with nothing installed:
 *
 * ```
 * pnpm --filter @textui/example-chat add @microsoft/agent-host-protocol
 * ```
 *
 * Written against protocol 0.7.0, from the package's own `src/types/`. What it
 * speaks is the subset this client needs: `initialize`, `listSessions`,
 * `subscribe`, `createSession`, `disposeSession`, `resolveSessionConfig`, and
 * the seven client-dispatchable actions that drive and answer a turn.
 */

export interface LiveHostOptions {
  /** `ws://host:port/…`, as the host advertises it. */
  url: string;
  /** A bearer token, if the host is behind one. Appended as `?tkn=`. */
  token?: string;
  clientId?: string;
  /** Told when the socket drops, so the badge can stop claiming otherwise. */
  onState?(state: 'connecting' | 'connected' | 'offline'): void;
}

/**
 * Versions to offer, newest first.
 *
 * Offering one the installed library has no types for is safe: AHP is additive
 * within 0.x, and every command used here has been stable across all of them.
 */
const VERSIONS = ['0.9.0', '0.8.0', '0.7.0'];

const ROOT = 'ahp-root://';

// --------------------------------------------------------------- the package

/**
 * What this file uses of `@microsoft/agent-host-protocol`.
 *
 * Declared rather than imported, so the example typechecks and its tests run
 * with the package absent. The specifier is a variable for the same reason:
 * a literal one is resolved at build time, and there would be nothing to
 * resolve it to.
 */
interface Subscription extends AsyncIterable<{ type: string; params?: unknown }> {
  close(): Promise<void>;
}

interface Client {
  connect(): void;
  shutdown(): Promise<void>;
  initialize(args: { clientId: string; protocolVersions: readonly string[] }): Promise<unknown>;
  request(method: string, params: unknown): Promise<Record<string, unknown>>;
  subscribe(uri: string): Promise<{
    result: { snapshot?: { state?: unknown } };
    subscription: Subscription;
  }>;
  dispatch(channel: string, action: unknown): unknown;
}

interface Mirror {
  readonly root: { agents?: unknown[] };
  applySnapshot(snapshot: unknown): void;
  apply(envelope: unknown): void;
}

interface Loaded {
  Client: new (transport: unknown, config?: unknown) => Client;
  Mirror: new () => Mirror;
  connect(url: string): Promise<unknown>;
  chatReducer(state: unknown, action: unknown): unknown;
  sessionReducer(state: unknown, action: unknown): unknown;
}

export class MissingProtocolPackage extends Error {
  constructor() {
    super('A live host needs @microsoft/agent-host-protocol. Install it in this example:\n'
      + '  pnpm --filter @textui/example-chat add @microsoft/agent-host-protocol\n'
      + 'Or leave --host off and drive the scripted one.');
    this.name = 'MissingProtocolPackage';
  }
}

async function load(): Promise<Loaded> {
  const base: string = '@microsoft/agent-host-protocol';
  try {
    const core = await import(base) as Record<string, never>;
    const client = await import(`${base}/client`) as Record<string, never>;
    const ws = await import(`${base}/ws`) as Record<string, never>;
    const transport = ws.WebSocketTransport as unknown as { connect(url: string): Promise<unknown> };
    return {
      Client: client.AhpClient as unknown as Loaded['Client'],
      Mirror: client.AhpStateMirror as unknown as Loaded['Mirror'],
      connect: (url) => transport.connect(url),
      chatReducer: core.chatReducer as unknown as Loaded['chatReducer'],
      sessionReducer: core.sessionReducer as unknown as Loaded['sessionReducer'],
    };
  } catch (error) {
    // Node says `ERR_MODULE_NOT_FOUND` for a missing package and a missing
    // file alike, and the message differs between the two ("Cannot find
    // package", "Cannot find module"), so the code is what is tested.
    const code = (error as { code?: string } | null)?.code;
    if (code === 'ERR_MODULE_NOT_FOUND' || code === 'MODULE_NOT_FOUND') {
      throw new MissingProtocolPackage();
    }
    throw error;
  }
}

// ------------------------------------------------------------- reading state

type Bag = Record<string, unknown>;

const bag = (value: unknown): Bag => (typeof value === 'object' && value !== null ? value as Bag : {});
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const str = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

/** `StringOrMarkdown` is a string or `{ markdown }`, and a reader wants neither. */
function plain(value: unknown): string | undefined {
  if (typeof value === 'string') return value === '' ? undefined : value;
  const found = str(bag(value).markdown) ?? str(bag(value).value);
  return found === '' ? undefined : found;
}

/**
 * One tool call, flattened out of an eight-state union.
 *
 * Which fields exist depends on the state - `toolInput` arrives when the
 * parameters are complete, `pastTenseMessage` and `content` only after it ran -
 * so everything is read defensively and what is not there yet is left out.
 */
function toolCall(value: unknown): ToolCall {
  const call = bag(value);
  const input = call.toolInput;
  const content = list(call.content);

  const text = content
    .map((entry) => plain(bag(entry).text) ?? plain(bag(entry).preview))
    .filter((entry): entry is string => entry !== undefined)
    .join('\n');
  const files = content
    .map((entry) => str(bag(bag(entry).file).uri) ?? str(bag(entry).uri))
    .filter((entry): entry is string => entry !== undefined);

  return {
    id: str(call.toolCallId) ?? randomUUID(),
    name: str(call.displayName) ?? str(call.toolName) ?? 'tool',
    toolName: str(call.toolName) ?? 'tool',
    status: (str(call.status) ?? 'running') as ToolCallStatus,
    // A `ContentRef` is a promise of content rather than content: reporting
    // nothing is better than reporting the reference as if it were the command.
    ...(typeof input === 'string' ? { input } : {}),
    ...(plain(call.intention) ?? plain(call.invocationMessage)
      ? { intention: (plain(call.intention) ?? plain(call.invocationMessage)) as string }
      : {}),
    ...(plain(call.pastTenseMessage) ? { outcome: plain(call.pastTenseMessage) as string } : {}),
    ...(text ? { output: text } : {}),
    ...(files.length > 0 ? { files } : {}),
    ...(plain(call.confirmationTitle) ? { confirmationTitle: plain(call.confirmationTitle) as string } : {}),
    ...(list(call.options).length > 0
      ? {
        options: list(call.options).map((option) => ({
          id: str(bag(option).id) ?? '',
          label: str(bag(option).label) ?? str(bag(option).id) ?? '',
        })),
      }
      : {}),
  };
}

/** `responseParts` is one ordered stream, and the order is the reasoning. */
function parts(value: unknown): ResponsePart[] {
  const out: ResponsePart[] = [];
  for (const entry of list(value)) {
    const part = bag(entry);
    const id = str(part.id) ?? randomUUID();
    switch (str(part.kind)) {
      // The prose is in `content`. Not `markdown`, not `text` - reading the
      // wrong name costs every word the agent said.
      case 'markdown':
        out.push({ kind: 'markdown', id, content: str(part.content) ?? '' });
        break;
      case 'reasoning':
        out.push({ kind: 'reasoning', id, content: str(part.content) ?? '' });
        break;
      case 'systemNotification':
        out.push({ kind: 'systemNotification', id, content: plain(part.content) ?? '' });
        break;
      case 'toolCall': {
        const call = toolCall(part.toolCall);
        out.push({ kind: 'toolCall', id: call.id, call });
        break;
      }
      default:
        break;
    }
  }
  return out;
}

function turn(value: unknown, running: boolean): Turn {
  const found = bag(value);
  const message = bag(found.message);
  const state = str(found.state);
  return {
    id: str(found.id) ?? randomUUID(),
    role: 'agent',
    ...(str(message.text) ? { message: str(message.text) as string } : {}),
    parts: parts(found.responseParts),
    state: running ? 'running'
      : state === 'cancelled' ? 'cancelled'
        : state === 'error' ? 'failed' : 'complete',
    ...(str(bag(message.model).id) ? { model: str(bag(message.model).id) as string } : {}),
    at: str(found.startedAt) ?? new Date(0).toISOString(),
    ...(typeof found.duration === 'number' ? { elapsedMs: found.duration } : {}),
  };
}

/**
 * The conversation, as the transcript reads it.
 *
 * A turn on the wire carries both what the person said and what the agent
 * answered; a transcript wants them as two blocks, so the message becomes a
 * user turn ahead of the agent's. And the running turn is `activeTurn`, not in
 * `turns` - a client that reads only the history shows an empty conversation
 * for exactly as long as somebody is watching one happen.
 */
function transcript(chat: Bag): Turn[] {
  const out: Turn[] = [];
  const add = (value: unknown, running: boolean): void => {
    const found = bag(value);
    const said = str(bag(found.message).text);
    if (said) {
      out.push({
        id: `${str(found.id) ?? ''}:said`,
        role: 'user',
        message: said,
        parts: [],
        state: 'complete',
        at: str(found.startedAt) ?? new Date(0).toISOString(),
      });
    }
    const agent = turn(found, running);
    delete agent.message;
    out.push(agent);
  };
  for (const entry of list(chat.turns)) add(entry, false);
  if (chat.activeTurn) add(chat.activeTurn, true);
  return out;
}

const KINDS: Record<string, QuestionKind> = {
  text: 'text', number: 'number', integer: 'integer', boolean: 'boolean',
  'single-select': 'single-select', 'multi-select': 'multi-select',
};

function question(value: unknown): Question {
  const found = bag(value);
  return {
    id: str(found.id) ?? randomUUID(),
    kind: KINDS[str(found.kind) ?? 'text'] ?? 'text',
    message: str(found.message) ?? str(found.title) ?? '',
    ...(found.required === true ? { required: true } : {}),
    ...(list(found.options).length > 0
      ? {
        options: list(found.options).map((option) => ({
          id: str(bag(option).id) ?? '',
          label: str(bag(option).label) ?? str(bag(option).id) ?? '',
        })),
      }
      : {}),
    ...(found.allowFreeformInput === true ? { allowFreeformInput: true } : {}),
  };
}

/**
 * What the agent is waiting for, if anything.
 *
 * `SessionState.inputNeeded` is the session-level summary and **not every host
 * fills it in**: VS Code 1.132 shows its own dialog while the session reports
 * status 40 and no `inputNeeded` key at all. The tool call is unambiguous
 * though - `pending-confirmation` carries the title, the input and the options -
 * so the chat is scanned when the field is empty.
 */
function pendingInput(session: Bag, chat: Bag): PendingInput | null {
  for (const entry of list(session.inputNeeded)) {
    const found = bag(entry);
    const id = str(found.id) ?? randomUUID();
    if (str(found.kind) === 'toolConfirmation') {
      return { kind: 'toolConfirmation', id, call: toolCall(found.toolCall) };
    }
    if (str(found.kind) === 'chatInput') {
      const request = bag(found.request);
      return {
        kind: 'chatInput',
        // The request's own id answers it, not the entry's.
        id: str(request.id) ?? id,
        message: str(request.message) ?? '',
        questions: list(request.questions).map(question),
      };
    }
  }

  const active = bag(chat.activeTurn);
  for (const part of list(active.responseParts)) {
    const found = bag(part);
    if (str(found.kind) !== 'toolCall') continue;
    const call = bag(found.toolCall);
    if (str(call.status) !== 'pending-confirmation') continue;
    const flat = toolCall(call);
    return { kind: 'toolConfirmation', id: flat.id, call: flat };
  }
  return null;
}

function summary(value: unknown): SessionSummary {
  const found = bag(value);
  const changes = bag(found.changes);
  return {
    resource: str(found.resource) ?? '',
    provider: str(found.provider) ?? 'unknown',
    title: str(found.title) ?? 'Untitled session',
    status: typeof found.status === 'number' ? found.status : 1,
    createdAt: str(found.createdAt) ?? '',
    modifiedAt: str(found.modifiedAt) ?? str(found.createdAt) ?? '',
    workingDirectories: list(found.workingDirectories).filter((dir): dir is string => typeof dir === 'string'),
    ...(str(found.activity) ? { activity: str(found.activity) as string } : {}),
    ...(found.changes
      ? {
        changes: {
          ...(typeof changes.files === 'number' ? { files: changes.files } : {}),
          ...(typeof changes.additions === 'number' ? { additions: changes.additions } : {}),
          ...(typeof changes.deletions === 'number' ? { deletions: changes.deletions } : {}),
        },
      }
      : {}),
  };
}

/**
 * The config schema, flattened to what a form needs.
 *
 * `enumLabels` and `enumDescriptions` are arrays parallel to `enum`, so they
 * are read by index rather than looked up by name. `sessionMutable` decides
 * whether a control is offered at all: absent means not changeable while the
 * session runs, and the cautious reading is the correct one.
 */
function config(value: unknown): SessionConfig {
  const found = bag(value);
  const schema = bag(found.schema);
  const properties = bag(schema.properties);
  const values = bag(found.values);

  return {
    properties: Object.entries(properties).map(([key, raw]): ConfigProperty => {
      const property = bag(raw);
      const labels = list(property.enumLabels);
      const descriptions = list(property.enumDescriptions);
      return {
        key,
        title: str(property.title) ?? key,
        ...(str(property.description) ? { description: str(property.description) as string } : {}),
        values: list(property.enum).map((entry, index) => ({
          value: String(entry),
          label: str(labels[index]) ?? String(entry),
          ...(str(descriptions[index]) ? { description: str(descriptions[index]) as string } : {}),
        })),
        sessionMutable: property.sessionMutable === true,
      };
    }),
    values: Object.fromEntries(Object.entries(values).map(([key, entry]) => [key, String(entry)])),
  };
}

function changeset(value: unknown): Changeset {
  const found = bag(value);
  return {
    status: str(found.status) === 'computing' ? 'computing' : 'complete',
    files: list(found.files).map((entry): FileEdit => {
      const edit = bag(bag(entry).edit);
      const before = str(bag(edit.before).uri);
      const after = str(bag(edit.after).uri);
      const diff = bag(edit.diff);
      return {
        uri: after ?? before ?? '',
        ...(before ? { before } : {}),
        ...(after ? { after } : {}),
        diff: {
          added: typeof diff.added === 'number' ? diff.added : 0,
          removed: typeof diff.removed === 'number' ? diff.removed : 0,
        },
      };
    }),
  };
}

/** The typed answer the protocol wants, built from the question that was asked. */
function answerValue(answer: Answer): unknown {
  return { state: 'submitted', value: { kind: answer.kind, value: answer.value } };
}

// ------------------------------------------------------------- the connection

export async function liveHost(options: LiveHostOptions): Promise<HostConnection & {
  close(): Promise<void>;
}> {
  const ahp = await load();
  const endpoint = options.token
    ? `${options.url}${options.url.includes('?') ? '&' : '?'}tkn=${encodeURIComponent(options.token)}`
    : options.url;

  let state: 'connecting' | 'connected' | 'offline' = 'connecting';
  const moveTo = (next: typeof state): void => { state = next; options.onState?.(next); };

  const transport = await ahp.connect(endpoint);
  const client = new ahp.Client(transport, {});
  const mirror = new ahp.Mirror();
  client.connect();

  const hello = bag(await client.initialize({
    clientId: options.clientId ?? `textui-chat-${randomUUID().slice(0, 8)}`,
    protocolVersions: VERSIONS,
  }));
  for (const snapshot of list(hello.snapshots)) mirror.applySnapshot(snapshot);
  moveTo('connected');

  // The root channel, for the agents it advertises. Drained rather than
  // polled: re-subscribing to take a fresh look tears down the stream.
  const root = await client.subscribe(ROOT);
  if (root.result.snapshot) mirror.applySnapshot(root.result.snapshot);
  void (async () => {
    try {
      for await (const event of root.subscription) {
        if (event.type === 'action') mirror.apply(event.params);
      }
    } catch { moveTo('offline'); }
  })();

  /** The chat a session dispatches to, remembered so it is asked for once. */
  const chats = new Map<SessionUri, string>();

  const snapshotOf = async (uri: string): Promise<Bag> => {
    const { result, subscription } = await client.subscribe(uri);
    // Closing drops *this consumer*. `unsubscribe` is channel-wide and would
    // kill the stream whatever else is reading it depends on.
    void subscription.close();
    return bag(result.snapshot?.state);
  };

  const chatOf = async (uri: SessionUri): Promise<string | null> => {
    const known = chats.get(uri);
    if (known) return known;
    const found = str((await snapshotOf(uri)).defaultChat);
    if (found) chats.set(uri, found);
    return found ?? null;
  };

  const dispatch = async (uri: SessionUri, action: unknown): Promise<void> => {
    const chat = await chatOf(uri);
    if (chat) client.dispatch(chat, action);
  };

  return {
    id: 'live',
    url: options.url,
    state: () => state,

    listSessions: async () => {
      const result = await client.request('listSessions', { channel: ROOT, limit: 100 });
      return list(result.items).map(summary);
    },

    agents: async (): Promise<Agent[]> => list(mirror.root.agents).map((entry) => {
      const agent = bag(entry);
      return {
        provider: str(agent.provider) ?? str(agent.id) ?? 'unknown',
        displayName: str(agent.displayName) ?? str(agent.provider) ?? 'Agent',
        ...(str(agent.description) ? { description: str(agent.description) as string } : {}),
        models: list(agent.models).map((raw) => {
          const model = bag(raw);
          return {
            id: str(model.id) ?? '',
            displayName: str(model.displayName) ?? str(model.id) ?? '',
            ...(list(model.thinkingLevels).length > 0
              ? { thinkingLevels: list(model.thinkingLevels).map(String) }
              : {}),
          };
        }),
      };
    }),

    resolveConfig: async ({ provider, workingDirectory }) => config(await client.request('resolveSessionConfig', {
      channel: ROOT,
      provider,
      ...(workingDirectory ? { workingDirectories: [`file://${workingDirectory}`] } : {}),
    })),

    createSession: async ({ provider, workingDirectory }) => {
      // The client chooses the URI, which is what makes the session
      // addressable before the host has answered.
      const resource = `ahp-session:/${randomUUID()}`;
      await client.request('createSession', {
        channel: ROOT,
        resource,
        provider,
        ...(workingDirectory ? { workingDirectories: [`file://${workingDirectory}`] } : {}),
      });
      return resource;
    },

    disposeSession: async (uri) => {
      await client.request('disposeSession', { channel: uri });
      chats.delete(uri);
    },

    setArchived: (uri, archived) => {
      client.dispatch(uri, { type: 'session/isArchivedChanged', isArchived: archived });
    },

    setRead: (uri, read) => {
      client.dispatch(uri, { type: 'session/isReadChanged', isRead: read });
    },

    /**
     * Watch one session, and the chat it dispatches to.
     *
     * Two channels, two reducers, one observer. Every action rebuilds the
     * whole view and re-emits it as a snapshot rather than being translated
     * into a delta: the reducers are the authority on what the state is now,
     * and a second, hand-written path from action to screen is a second answer
     * to the same question. The transcript already renders from a snapshot -
     * that is what it does when it is opened - so this costs nothing but a
     * rebuild per action.
     */
    subscribe: (uri, observer) => {
      let live = true;
      const closers: (() => void)[] = [];
      let session: Bag = {};
      let chat: Bag = {};

      const emit = (): void => {
        if (!live) return;
        const all = transcript(chat);
        const active = all.find((found) => found.state === 'running');
        const event: HostEvent = {
          type: 'snapshot',
          turns: all.filter((found) => found !== active),
          ...(active ? { active } : {}),
          ...(pendingInput(session, chat) ? { input: pendingInput(session, chat) as PendingInput } : {}),
          status: typeof session.status === 'number' ? session.status : 1,
        };
        observer(event);
      };

      void (async () => {
        const opened = await client.subscribe(uri);
        if (!live) { void opened.subscription.close(); return; }
        closers.push(() => void opened.subscription.close());
        session = bag(opened.result.snapshot?.state);

        const chatUri = str(session.defaultChat);
        if (chatUri) {
          chats.set(uri, chatUri);
          const talking = await client.subscribe(chatUri);
          if (!live) { void talking.subscription.close(); return; }
          closers.push(() => void talking.subscription.close());
          chat = bag(talking.result.snapshot?.state);
          void (async () => {
            for await (const event of talking.subscription) {
              if (event.type !== 'action') continue;
              chat = bag(ahp.chatReducer(chat, bag(event.params).action));
              emit();
            }
          })();
        }
        emit();

        for await (const event of opened.subscription) {
          if (event.type !== 'action') continue;
          session = bag(ahp.sessionReducer(session, bag(event.params).action));
          emit();
        }
      })().catch(() => moveTo('offline'));

      return {
        close: () => {
          live = false;
          for (const close of closers) close();
        },
      };
    },

    say: (uri, text, model) => {
      void dispatch(uri, {
        type: 'chat/turnStarted',
        turnId: randomUUID(),
        startedAt: new Date().toISOString(),
        message: {
          text,
          origin: { kind: 'user' },
          ...(model ? { model: { id: model } } : {}),
        },
      });
    },

    stopTurn: (uri) => {
      void (async () => {
        const chatUri = await chatOf(uri);
        if (!chatUri) return;
        // The id is read back rather than remembered: a turn somebody started
        // in an editor is stoppable from here too, and its id is in the state.
        const state = await snapshotOf(chatUri);
        const active = bag(state.activeTurn);
        const turnId = str(active.id);
        if (!turnId) return;
        const started = Date.parse(str(active.startedAt) ?? '');
        client.dispatch(chatUri, {
          type: 'chat/turnCancelled',
          turnId,
          duration: Number.isNaN(started) ? 0 : Math.max(0, Date.now() - started),
        });
      })();
    },

    confirmToolCall: (uri, toolCallId, approved, optionId) => {
      void dispatch(uri, approved
        ? {
          type: 'chat/toolCallConfirmed',
          toolCallId,
          approved: true,
          // A person pressed a button, and the record of why this ran should
          // say so rather than blaming a setting.
          confirmed: 'user-action',
          ...(optionId ? { selectedOptionId: optionId } : {}),
        }
        : { type: 'chat/toolCallConfirmed', toolCallId, approved: false, reason: 'denied' });
    },

    completeInput: (uri, requestId, accepted, answers) => {
      const typed = Object.fromEntries(
        Object.entries(answers).map(([id, answer]) => [id, answerValue(answer)]),
      );
      void dispatch(uri, {
        type: 'chat/inputCompleted',
        requestId,
        response: accepted ? 'accept' : 'decline',
        // Omitted rather than empty: an accept carrying no answers resumes the
        // agent on the ones it already had, which for a question it has just
        // asked is none.
        ...(Object.keys(typed).length > 0 ? { answers: typed } : {}),
      });
    },

    changes: async (uri) => {
      const state = await snapshotOf(uri);
      const entry = list(state.changesets)
        .map(bag)
        // The session-wide view. A template with variables in it is a diff
        // between two turns, and there is nothing here to fill them in from.
        .find((found) => str(found.uriTemplate) && !str(found.uriTemplate)?.includes('{'));
      const template = str(entry?.uriTemplate);
      if (!template) return { status: 'complete', files: [] };
      return changeset(await snapshotOf(template));
    },

    detail: async (uri): Promise<SessionDetail> => {
      const state = await snapshotOf(uri);
      const chatUri = str(state.defaultChat) ?? null;
      if (chatUri) chats.set(uri, chatUri);
      const talking = chatUri ? await snapshotOf(chatUri) : {};
      const last = [...list(talking.turns), talking.activeTurn]
        .map(bag)
        .reverse()
        .find((found) => str(bag(bag(found).message).model));

      return {
        resource: uri,
        chat: chatUri,
        chats: list(state.chats).map((entry) => ({
          resource: str(bag(entry).resource) ?? '',
          title: str(bag(entry).title) ?? 'Chat',
        })),
        lifecycle: (str(state.lifecycle) ?? 'creating') as SessionDetail['lifecycle'],
        config: config(state.config),
        ...(last ? { model: str(bag(bag(bag(last).message).model).id) as string } : {}),
        ...(str(state.activity) ? { activity: str(state.activity) as string } : {}),
      };
    },

    config: async (uri) => config((await snapshotOf(uri)).config),

    setConfig: (uri, key, value) => {
      // One key. The action merges into `config.values`, so sending the object
      // writes back everything this client happened to be holding - including
      // whatever another client changed while it was on screen.
      client.dispatch(uri, { type: 'session/configChanged', config: { [key]: value } });
    },

    close: async () => {
      moveTo('offline');
      await client.shutdown();
    },
  };
}
