import type { HostConnection, HostEvent } from './connection.js';
import type {
  Agent, Changeset, ChatInputRequest, PendingInput, ResponsePart, SessionConfig, SessionDetail,
  SessionSummary, SessionUri, ToolCall, Turn,
} from './types.js';
import { SessionFlag } from './types.js';

/**
 * A host, scripted.
 *
 * An example nothing checks is an example that is already broken, and nothing
 * can check one that needs an editor running on another machine. So the seam
 * is `HostConnection` and this is the other implementation of it: the same
 * shapes, the same order, the same "the turn appears when the host reduced it".
 *
 * Time is a `pump`, not a timer. The application drives it from a ticker and a
 * test calls it in a loop, so what the test exercises is the streaming path
 * rather than a fixture that arrived all at once.
 *
 * Two things it is deliberately strict about, both because a lie here reads
 * as a bug in the client:
 *
 * - **The status is derived, never assigned.** It is computed from what this
 *   host is actually holding, so a session cannot say "waiting on you" with
 *   nothing waiting. It did, and the bug looked exactly like a client that
 *   drops a pending confirmation when you leave the screen.
 * - **The sessions differ, and so do the replies.** Every conversation opening
 *   on the same text, and every message getting the same answer, hides every
 *   layout problem that only appears on prose of another shape.
 */
export interface FakeHost extends HostConnection {
  /** Emit the next scripted step. False when there is nothing waiting. */
  pump(): boolean;
  /** Everything the script can emit without being answered. */
  drain(limit?: number): void;
  pending(): number;
}

type Step = () => void;

const WORDS = (text: string): string[] => text.split(/(?<=\s)/);

/** What the host says this provider's sessions can be told to do. */
const CONFIG: SessionConfig['properties'] = [
  {
    key: 'permissionMode',
    title: 'Permissions',
    description: 'How much the agent may do before it asks.',
    sessionMutable: true,
    values: [
      { value: 'default', label: 'Ask each time', description: 'Every tool call is confirmed' },
      { value: 'acceptEdits', label: 'Accept edits', description: 'File edits run; commands still ask' },
      { value: 'plan', label: 'Plan only', description: 'Read and reason, change nothing' },
      { value: 'bypass', label: 'Bypass', description: 'Nothing is confirmed' },
    ],
  },
  {
    key: 'isolation',
    title: 'Isolation',
    description: 'Where the agent works. Fixed once the session exists.',
    sessionMutable: false,
    values: [
      { value: 'workspace', label: 'The workspace itself' },
      { value: 'worktree', label: 'A git worktree' },
    ],
  },
];

let counter = 0;
const nextId = (prefix: string): string => `${prefix}${++counter}`;

const AT = '2026-08-22T10:00:00.000Z';

export function fakeHost(): FakeHost {
  const summaries = new Map<SessionUri, SessionSummary>();
  const turns = new Map<SessionUri, Turn[]>();
  const active = new Map<SessionUri, Turn>();
  const inputs = new Map<SessionUri, PendingInput>();
  const changesets = new Map<SessionUri, Changeset>();
  const configs = new Map<SessionUri, Record<string, string>>();
  const observers = new Map<SessionUri, Set<(event: HostEvent) => void>>();
  const chats = new Map<SessionUri, string>();
  const models = new Map<SessionUri, string>();
  /** `IsRead` and `IsArchived` only. Nothing about what the session is doing. */
  const flags = new Map<SessionUri, number>();
  const failed = new Set<SessionUri>();
  const script: Step[] = [];

  const emit = (uri: SessionUri, event: HostEvent): void => {
    for (const observer of observers.get(uri) ?? []) observer(event);
  };

  /**
   * The status, from what is actually here.
   *
   * Activity is a fact about this host's own maps - a pending input, a running
   * turn, a failure - and the two client flags are carried alongside it. There
   * is no way to write a status by hand, which is the point: a seeded session
   * once claimed `InputNeeded` while holding no pending input, and opening it
   * showed a conversation with nothing to answer. That is indistinguishable
   * from a client that loses the request, and it cost an afternoon.
   */
  const statusOf = (uri: SessionUri): number => {
    const activity = inputs.has(uri) ? SessionFlag.InputNeeded
      : active.has(uri) ? SessionFlag.InProgress
        : failed.has(uri) ? SessionFlag.Error
          : SessionFlag.Idle;
    return activity | (flags.get(uri) ?? 0);
  };

  /** Recompute, and tell anyone watching if it moved. */
  const touch = (uri: SessionUri): void => {
    const summary = summaries.get(uri);
    if (!summary) return;
    const status = statusOf(uri);
    summaries.set(uri, { ...summary, status, modifiedAt: AT });
    emit(uri, { type: 'status', status });
  };

  const setFlag = (uri: SessionUri, flag: number, on: boolean): void => {
    const current = flags.get(uri) ?? 0;
    flags.set(uri, on ? current | flag : current & ~flag);
    touch(uri);
  };

  // ------------------------------------------------------------ the catalogue

  const seed = (options: {
    id: string;
    provider: string;
    title: string;
    dir: string;
    model?: string;
    read?: boolean;
    archived?: boolean;
    failed?: boolean;
    permissions?: string;
    isolation?: string;
    activity?: string;
    turns?: Turn[];
    active?: Turn;
    input?: PendingInput;
    changes?: Changeset;
  }): void => {
    const { id } = options;
    flags.set(id, (options.read === false ? 0 : SessionFlag.IsRead)
      | (options.archived ? SessionFlag.IsArchived : 0));
    if (options.failed) failed.add(id);
    turns.set(id, options.turns ?? []);
    if (options.active) active.set(id, options.active);
    if (options.input) inputs.set(id, options.input);
    if (options.changes) changesets.set(id, options.changes);
    // `ahp-chat:/<uuid>`, which is the protocol's own shape - a chat is its
    // own channel, not a path under the session.
    chats.set(id, `ahp-chat:/${id.split('/').pop() ?? id}`);
    if (options.model) models.set(id, options.model);
    configs.set(id, {
      permissionMode: options.permissions ?? 'default',
      isolation: options.isolation ?? 'workspace',
    });
    summaries.set(id, {
      resource: id,
      provider: options.provider,
      title: options.title,
      status: statusOf(id),
      createdAt: AT,
      modifiedAt: AT,
      workingDirectories: [options.dir],
      ...(options.activity ? { activity: options.activity } : {}),
      ...(options.changes
        ? {
          changes: {
            files: options.changes.files.length,
            additions: options.changes.files.reduce((n, f) => n + f.diff.added, 0),
            deletions: options.changes.files.reduce((n, f) => n + f.diff.removed, 0),
          },
        }
        : {}),
    });
  };

  /**
   * One session blocked on a confirmation, and the confirmation to go with it.
   *
   * The whole point of the seed: a reader arriving at the catalogue can answer
   * something without saying anything first, and the row that says a person is
   * wanted is a row where one actually is.
   */
  const blockedCall: ToolCall = {
    id: 'seed-c2', name: 'Bash', toolName: 'Bash', status: 'pending-confirmation',
    input: 'make -f Makefile.linux clean all',
    intention: 'Rebuild libbrb_core against the patched libkqueue',
    confirmationTitle: 'Run a command in /brb_main/src/brb_framework?',
    options: [
      { id: 'once', label: 'Allow once' },
      { id: 'session', label: 'Allow for this session' },
    ],
  };

  seed({
    id: 'ahp-session:/1f0a',
    provider: 'claude',
    title: 'Kqueue events on Linux',
    dir: 'file:///brb_main/src/brb_framework',
    model: 'claude-opus-5',
    activity: 'waiting for permission to run a command',
    turns: [
      {
        id: 't1', role: 'user', message: 'EVFILT_FS never fires on Linux. Is that us or libkqueue?',
        parts: [], state: 'complete', at: AT,
      },
      {
        id: 't2',
        role: 'agent',
        state: 'complete',
        model: 'claude-opus-5',
        at: AT,
        elapsedMs: 21_400,
        parts: [
          { kind: 'reasoning', id: 'r1', content: 'The filter is registered, so the question is whether libkqueue implements it at all.' },
          { kind: 'markdown', id: 'm1', content: 'Short answer: **libkqueue**, not us.\n\nBoth `EVFILT_AIO` and `EVFILT_FS` are compiled out:' },
          {
            kind: 'toolCall',
            id: 'c1',
            call: {
              id: 'c1', name: 'Search', toolName: 'Grep', status: 'completed',
              input: 'rg -n "EVFILT_FS" /usr/include/kqueue',
              intention: 'Look for the filter in the installed headers',
              outcome: 'Found 2 matches',
              output: 'sys/event.h:74:#if 0\nsys/event.h:75:#define EVFILT_FS  (-9)',
            },
          },
          { kind: 'markdown', id: 'm2', content: 'They sit behind `#if 0`. Re-defining them compiles and then silently never delivers an event, which is the worst of the three outcomes.\n\n- keep the FreeBSD path on `EVFILT_FS`\n- on Linux, poll or use `inotify` directly' },
        ],
      },
    ],
    active: {
      id: 't3',
      role: 'agent',
      state: 'running',
      model: 'claude-opus-5',
      at: AT,
      parts: [
        { kind: 'markdown', id: 'm3', content: 'Let me check that the patched header actually builds before you take it any further.' },
        { kind: 'toolCall', id: blockedCall.id, call: blockedCall },
      ],
    },
    input: { kind: 'toolConfirmation', id: 'seed-i1', call: blockedCall },
  });

  seed({
    id: 'ahp-session:/6b21',
    provider: 'claude',
    title: 'Split the transcript viewport',
    dir: 'file:///github/textui',
    model: 'claude-sonnet-5',
    activity: 'reading packages/core/src/ui/data.ts',
    permissions: 'acceptEdits',
    turns: [
      {
        id: 's2-t1', role: 'user', message: 'The Feed draws nothing inside a content-sized panel. Why?',
        parts: [], state: 'complete', at: AT,
      },
    ],
    // Mid-flight, and nothing is blocked. A reader arriving here sees a turn
    // being written, which is the state a transcript is hardest to get right in.
    active: {
      id: 's2-t2',
      role: 'agent',
      state: 'running',
      model: 'claude-sonnet-5',
      at: AT,
      parts: [
        { kind: 'reasoning', id: 's2-r1', content: 'Sizing rule first: a component that fills has a measured height, one that does not draws everything.' },
        { kind: 'markdown', id: 's2-m1', content: 'Because it takes its viewport from `useMeasure`, and in a content-sized panel there is nothing to measure - the height is zero, the window is zero rows, and it' },
      ],
    },
  });

  seed({
    id: 'ahp-session:/9c74',
    provider: 'copilotcli',
    title: 'Why does the composer eat q',
    dir: 'file:///github/textui',
    model: 'gpt-5',
    turns: [
      {
        id: 's3-t1', role: 'user', message: 'q does nothing while I am typing. Bug?',
        parts: [], state: 'complete', at: AT,
      },
      {
        id: 's3-t2',
        role: 'agent',
        state: 'complete',
        model: 'gpt-5',
        at: AT,
        elapsedMs: 3_100,
        parts: [
          { kind: 'markdown', id: 's3-m1', content: 'No - that is the focus model working. The focused node is offered a key before any keybinding, so while the composer has it, `q` is a letter.\n\nBind single letters to a focus scope and they exist only where they mean something.' },
        ],
      },
    ],
  });

  seed({
    id: 'ahp-session:/2d55',
    provider: 'claude',
    title: 'Advisor case 412 triage',
    dir: 'file:///brb_main/src/service_advisor',
    model: 'claude-opus-5',
    read: false,
    failed: true,
    permissions: 'plan',
    turns: [
      {
        id: 's4-t1', role: 'user', message: 'Pull the Desk ticket behind case 412 and summarise it.',
        parts: [], state: 'complete', at: AT,
      },
      {
        id: 's4-t2',
        role: 'agent',
        state: 'failed',
        model: 'claude-opus-5',
        at: AT,
        elapsedMs: 900,
        parts: [
          { kind: 'systemNotification', id: 's4-n1', content: 'The session ended: the host refused the request.' },
          { kind: 'markdown', id: 's4-m1', content: 'The host answered `-32007 Authentication is required to use Claude`. That is a sign-in on the host, not a network problem here.' },
        ],
      },
    ],
  });

  seed({
    id: 'ahp-session:/4e18',
    provider: 'claude',
    title: 'Old build script cleanup',
    dir: 'file:///brb_main/src/brb_backend',
    model: 'claude-sonnet-5',
    archived: true,
    turns: [
      {
        id: 's5-t1', role: 'user', message: 'Delete compileFramework.sh from the Linux path.',
        parts: [], state: 'complete', at: AT,
      },
      {
        id: 's5-t2',
        role: 'agent',
        state: 'complete',
        model: 'claude-sonnet-5',
        at: AT,
        elapsedMs: 12_000,
        parts: [
          { kind: 'markdown', id: 's5-m1', content: 'Left it in place. It is FreeBSD-only - `/usr/local/bin/bash` and `md5 -q` - so nothing on Linux calls it and removing it costs the FreeBSD build.' },
        ],
      },
    ],
    changes: {
      status: 'complete',
      files: [
        { uri: 'file:///brb_main/src/brb_backend/compileLinux.sh', before: 'x', after: 'y', diff: { added: 4, removed: 2 } },
      ],
    },
  });

  // ------------------------------------------------------------------ scripts

  /** Stream one prose part into the running turn, a word per pump. */
  function prose(uri: SessionUri, kind: 'markdown' | 'reasoning', text: string): void {
    const id = nextId(kind === 'markdown' ? 'm' : 'r');
    script.push(() => {
      const turn = active.get(uri);
      if (turn) turn.parts.push({ kind, id, content: '' } as ResponsePart);
    });
    for (const word of WORDS(text)) {
      script.push(() => {
        const turn = active.get(uri);
        const found = turn?.parts.find((p) => p.id === id);
        if (found && (found.kind === 'markdown' || found.kind === 'reasoning')) found.content += word;
        emit(uri, { type: 'delta', partId: id, kind, text: word });
      });
    }
  }

  /** Add a tool call, then complete it a pump later. */
  function tool(uri: SessionUri, call: Omit<ToolCall, 'id' | 'status'>, done: Partial<ToolCall>): void {
    const made: ToolCall = { ...call, id: nextId('c'), status: 'running' };
    script.push(() => {
      active.get(uri)?.parts.push({ kind: 'toolCall', id: made.id, call: made });
      emit(uri, { type: 'toolCall', call: made });
    });
    script.push(() => {
      made.status = done.status ?? 'completed';
      Object.assign(made, done);
      emit(uri, { type: 'toolCall', call: made });
    });
  }

  /** Block on a confirmation. Nothing after this runs until it is answered. */
  function asks(uri: SessionUri, call: Omit<ToolCall, 'id' | 'status'>): void {
    const made: ToolCall = { ...call, id: nextId('c'), status: 'pending-confirmation' };
    script.push(() => {
      active.get(uri)?.parts.push({ kind: 'toolCall', id: made.id, call: made });
      emit(uri, { type: 'toolCall', call: made });
      const input: PendingInput = { kind: 'toolConfirmation', id: nextId('i'), call: made };
      inputs.set(uri, input);
      emit(uri, { type: 'inputNeeded', input });
      touch(uri);
    });
  }

  /** Block on a question, which is a different thing entirely. */
  function elicits(uri: SessionUri, input: Omit<ChatInputRequest, 'id' | 'kind'>): void {
    script.push(() => {
      const made: PendingInput = { kind: 'chatInput', id: nextId('i'), ...input };
      inputs.set(uri, made);
      emit(uri, { type: 'inputNeeded', input: made });
      touch(uri);
    });
  }

  function finish(uri: SessionUri, closing: string, options: { failed?: boolean; changes?: Changeset } = {}): void {
    if (closing) prose(uri, 'markdown', closing);
    script.push(() => {
      const turn = active.get(uri);
      if (!turn) return;
      turn.state = options.failed ? 'failed' : 'complete';
      turn.elapsedMs = 18_200;
      turns.get(uri)?.push(turn);
      active.delete(uri);
      if (options.failed) failed.add(uri); else failed.delete(uri);
      emit(uri, { type: 'turnComplete', turn });
      touch(uri);

      if (!options.changes) return;
      changesets.set(uri, options.changes);
      emit(uri, { type: 'changes', changes: options.changes });
    });
  }

  /**
   * What the agent does when it is spoken to.
   *
   * Four shapes, and which one runs depends on what was said - a question gets
   * an answer, "run the tests" gets a command that asks first, a choice gets an
   * elicitation, and something that cannot work fails. One canned reply to
   * everything is a fixture that only ever proves the client can render *it*:
   * the short one never scrolls, the long one always does, the failing one is
   * the only thing that renders a system notification, and none of that is
   * exercised by a script that always says the same paragraph.
   */
  function reply(uri: SessionUri, said: string): void {
    const userTurn: Turn = { id: nextId('u'), role: 'user', message: said, parts: [], state: 'complete', at: AT };
    const model = models.get(uri) ?? 'claude-opus-5';
    const agentTurn: Turn = { id: nextId('a'), role: 'agent', parts: [], state: 'running', model, at: AT };

    script.push(() => {
      turns.get(uri)?.push(userTurn);
      emit(uri, { type: 'turnStarted', turn: userTurn });
      active.set(uri, agentTurn);
      emit(uri, { type: 'turnStarted', turn: agentTurn });
      touch(uri);
    });

    switch (pick(said)) {
      case 'run':
        prose(uri, 'reasoning', 'The composer swallows single-letter keys, so a global `q` cannot exist while it has focus. ');
        prose(uri, 'markdown', 'Two things are true at once here.\n\nThe **composer owns the keyboard** while it is focused, so every single-letter binding has to live in a focus scope rather than globally. What is left global is the modified set:\n\n- `ctrl+p` for the palette\n- `ctrl+c` to stop the turn\n\nLet me look at what the transcript does with the rest.');
        tool(uri, {
          name: 'Read', toolName: 'Read',
          input: 'packages/core/src/app/input.ts',
          intention: 'Read the input router, to see who gets a key first',
        }, {
          outcome: 'Read 214 lines',
          output: 'const order = [layers, screen, surfaces, global];\n// A layer that traps focus gets the key before anything under it.',
        });
        asks(uri, {
          name: 'Bash', toolName: 'Bash',
          input: 'pnpm --filter @textui/core test -- input.test.ts',
          intention: 'Run the input router tests',
          confirmationTitle: 'Run a command in /github/textui?',
          options: [
            { id: 'once', label: 'Allow once' },
            { id: 'session', label: 'Allow for this session' },
          ],
        });
        return;

      case 'ask':
        prose(uri, 'markdown', 'Both work, and they fail differently, so this is yours to pick rather than mine.');
        elicits(uri, {
          message: 'Two ways to keep the composer from eating the keys.',
          questions: [
            {
              id: 'q1',
              kind: 'single-select',
              message: 'Where should the single-letter keys be registered?',
              required: true,
              options: [
                { id: 'transcript-scope', label: 'On the transcript scope, so the composer never sees them' },
                { id: 'composer-escape', label: 'Globally, and escape blurs the composer first' },
                { id: 'both', label: 'Both, with the transcript winning' },
              ],
              allowFreeformInput: true,
            },
            { id: 'q2', kind: 'boolean', message: 'Add a test that types into the composer and asserts q is not quit?' },
          ],
        });
        return;

      case 'fail':
        prose(uri, 'reasoning', 'Check the host answered at all before blaming the harness. ');
        tool(uri, {
          name: 'Bash', toolName: 'Bash',
          input: 'ssh dev82 -p 2229 make -f Makefile.linux',
          intention: 'Build on the FreeBSD box',
        }, { status: 'failed', outcome: 'Exited 255', exitCode: 255, output: 'ssh: connect to host dev82.brbyte.com port 2229: Connection timed out' });
        finish(uri, 'The box did not answer on 2229. That is the tunnel, not the build - nothing was compiled, so nothing is broken.', { failed: true });
        return;

      default:
        // Short, and with no tool calls at all. The shape a transcript is
        // least often tested against, because a fixture is always the long one.
        prose(uri, 'markdown', `Yes - **${said.trim().slice(0, 40)}** is the part that matters.\n\nThe focused node is offered the key first, so a binding only exists where its scope is mounted.`);
        finish(uri, '');
    }
  }

  /**
   * Which script.
   *
   * Read off what was said, so a person driving the example can choose what to
   * exercise; the counter only decides when the words say nothing, which keeps
   * "hello" from being the same conversation every time.
   */
  let rotation = 0;
  function pick(said: string): 'run' | 'ask' | 'fail' | 'short' {
    const text = said.toLowerCase();
    // Failure first: "the build fails" names both, and the interesting half of
    // it is the failure.
    if (/\b(fail|fails|error|broken|ssh|dev82|timeout)\b/.test(text)) return 'fail';
    if (/\b(run|test|tests|build|compile|pnpm|make)\b/.test(text)) return 'run';
    if (/\b(which|choose|option|options|prefer)\b/.test(text)) return 'ask';
    return (['short', 'run', 'ask', 'fail'] as const)[rotation++ % 4] ?? 'short';
  }

  /** What it does once the command has been allowed. */
  function afterApproval(uri: SessionUri, call: ToolCall, approved: boolean): void {
    script.push(() => {
      call.status = approved ? 'completed' : 'cancelled';
      call.outcome = approved ? 'Ran in 4.2s, 38 passed' : 'Denied';
      if (approved) call.output = 'Test Files  1 passed (1)\n     Tests  38 passed (38)';
      call.exitCode = approved ? 0 : undefined;
      emit(uri, { type: 'toolCall', call });
    });

    if (!approved) {
      finish(uri, 'Left it alone. Tell me what you want to run instead.');
      return;
    }

    // A question, which is not a confirmation: no tool call, its own prose,
    // and choices that are lost entirely if it is rendered as a yes/no.
    elicits(uri, {
      message: 'The tests pass, so the fix is a choice about where the keys live.',
      questions: [
        {
          id: 'q1',
          kind: 'single-select',
          message: 'Where should the single-letter keys be registered?',
          required: true,
          options: [
            { id: 'transcript-scope', label: 'On the transcript scope, so the composer never sees them' },
            { id: 'composer-escape', label: 'Globally, and escape blurs the composer first' },
            { id: 'both', label: 'Both, with the transcript winning' },
          ],
          allowFreeformInput: true,
        },
        { id: 'q2', kind: 'boolean', message: 'Add a test that types into the composer and asserts q is not quit?' },
      ],
    });
  }

  /** One scripted step. The application's ticker and a test's loop share it. */
  function pump(): boolean {
    const step = script.shift();
    if (!step) return false;
    step();
    return true;
  }

  // --------------------------------------------------------------- connection

  return {
    id: 'fake',
    url: 'fake://scripted',
    state: () => 'connected',

    listSessions: async () => [...summaries.values()],

    agents: async (): Promise<Agent[]> => [
      {
        provider: 'claude',
        displayName: 'Claude Code',
        description: 'Anthropic, in the editor',
        models: [
          { id: 'claude-opus-5', displayName: 'Opus 5', thinkingLevels: ['low', 'medium', 'high', 'xhigh'] },
          { id: 'claude-sonnet-5', displayName: 'Sonnet 5', thinkingLevels: ['low', 'medium', 'high'] },
        ],
      },
      { provider: 'copilotcli', displayName: 'Copilot CLI', models: [{ id: 'gpt-5', displayName: 'GPT-5' }] },
    ],

    resolveConfig: async (): Promise<SessionConfig> => ({
      properties: CONFIG,
      values: { permissionMode: 'default', isolation: 'workspace' },
    }),

    createSession: async ({ provider, workingDirectory }) => {
      const uri = `ahp-session:/${(0x1000 + summaries.size).toString(16)}`;
      seed({
        id: uri,
        provider,
        title: 'New session',
        dir: workingDirectory ? `file://${workingDirectory}` : '',
      });
      return uri;
    },

    disposeSession: async (uri) => {
      summaries.delete(uri);
      turns.delete(uri);
      active.delete(uri);
      inputs.delete(uri);
      chats.delete(uri);
      flags.delete(uri);
      failed.delete(uri);
    },

    setArchived: (uri, archived) => setFlag(uri, SessionFlag.IsArchived, archived),
    setRead: (uri, read) => setFlag(uri, SessionFlag.IsRead, read),

    subscribe: (uri, observer) => {
      let set = observers.get(uri);
      if (!set) { set = new Set(); observers.set(uri, set); }
      set.add(observer);
      observer({
        type: 'snapshot',
        turns: turns.get(uri) ?? [],
        ...(active.get(uri) ? { active: active.get(uri) as Turn } : {}),
        ...(inputs.get(uri) ? { input: inputs.get(uri) as PendingInput } : {}),
        status: statusOf(uri),
      });
      const changes = changesets.get(uri);
      if (changes) observer({ type: 'changes', changes });
      // Closing drops this consumer. It does not unsubscribe the channel -
      // doing that to shed a duplicate is what kills the stream everything
      // else is reading.
      return { close: () => { set?.delete(observer); } };
    },

    say: (uri, text) => { reply(uri, text); },

    stopTurn: (uri) => {
      script.length = 0;
      const turn = active.get(uri);
      if (turn) {
        turn.state = 'cancelled';
        turns.get(uri)?.push(turn);
        active.delete(uri);
        emit(uri, { type: 'turnComplete', turn });
      }
      inputs.delete(uri);
      emit(uri, { type: 'inputResolved' });
      touch(uri);
    },

    confirmToolCall: (uri, toolCallId, approved) => {
      const input = inputs.get(uri);
      if (!input || input.kind !== 'toolConfirmation' || input.call.id !== toolCallId) return;
      inputs.delete(uri);
      emit(uri, { type: 'inputResolved' });
      touch(uri);
      afterApproval(uri, input.call, approved);
    },

    completeInput: (uri, requestId, accepted, answers) => {
      const input = inputs.get(uri);
      if (!input || input.id !== requestId) return;
      inputs.delete(uri);
      emit(uri, { type: 'inputResolved' });
      touch(uri);
      const chosen = answers.q1;
      const where = !accepted ? 'nothing'
        : chosen?.kind === 'selected' ? chosen.value
          : chosen?.kind === 'text' ? chosen.value : 'nothing';
      finish(uri, `Right - **${where}**. I will move the bindings and leave the modified keys where they are.`, {
        changes: {
          status: 'complete',
          files: [
            { uri: 'file:///github/textui/examples/chat/src/control.ts', before: 'x', after: 'y', diff: { added: 34, removed: 6 } },
            { uri: 'file:///github/textui/examples/chat/test/keys.test.tsx', after: 'y', diff: { added: 51, removed: 0 } },
          ],
        },
      });
    },

    changes: async (uri) => changesets.get(uri) ?? { status: 'complete', files: [] },

    detail: async (uri): Promise<SessionDetail> => {
      const chat = chats.get(uri) ?? null;
      const history = turns.get(uri) ?? [];
      const last = [...history, ...(active.get(uri) ? [active.get(uri) as Turn] : [])]
        .filter((turn) => turn.model).pop();
      return {
        resource: uri,
        chat,
        chats: chat ? [{ resource: chat, title: summaries.get(uri)?.title ?? 'Chat' }] : [],
        lifecycle: summaries.has(uri) ? 'ready' : 'creating',
        config: {
          properties: CONFIG,
          values: { permissionMode: 'default', isolation: 'workspace', ...(configs.get(uri) ?? {}) },
        },
        ...(last?.model ? { model: last.model } : {}),
        ...(summaries.get(uri)?.activity ? { activity: summaries.get(uri)?.activity as string } : {}),
      };
    },

    config: async (uri): Promise<SessionConfig> => ({
      properties: CONFIG,
      values: { permissionMode: 'default', isolation: 'workspace', ...(configs.get(uri) ?? {}) },
    }),

    setConfig: (uri, key, value) => {
      // One key, merged. Writing the whole object back is how a value another
      // client changed a moment ago is quietly reverted.
      configs.set(uri, { ...(configs.get(uri) ?? {}), [key]: value });
    },

    pump,

    drain: (limit = 5000) => {
      for (let i = 0; i < limit; i++) if (!pump()) break;
    },

    pending: () => script.length,
  };
}
