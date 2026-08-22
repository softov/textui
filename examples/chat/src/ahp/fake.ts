import type { HostConnection, HostEvent } from './connection.js';
import type {
  Agent, Changeset, PendingInput, ResponsePart, SessionConfig, SessionSummary,
  SessionUri, ToolCall, Turn,
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
  const script: Step[] = [];

  const emit = (uri: SessionUri, event: HostEvent): void => {
    for (const observer of observers.get(uri) ?? []) observer(event);
  };

  const setStatus = (uri: SessionUri, status: number): void => {
    const summary = summaries.get(uri);
    if (!summary) return;
    summaries.set(uri, { ...summary, status, modifiedAt: AT });
    emit(uri, { type: 'status', status });
  };

  // ------------------------------------------------------------ the catalogue

  for (const seed of [
    { id: 'ahp-session:/1f0a', provider: 'claude', title: 'Kqueue events on Linux', status: SessionFlag.InputNeeded | SessionFlag.IsRead, dir: 'file:///brb_main/src/brb_framework' },
    { id: 'ahp-session:/6b21', provider: 'claude', title: 'Split the transcript viewport', status: SessionFlag.InProgress | SessionFlag.IsRead, dir: 'file:///github/textui' },
    { id: 'ahp-session:/9c74', provider: 'copilotcli', title: 'Why does the composer eat q', status: SessionFlag.Idle | SessionFlag.IsRead, dir: 'file:///github/textui' },
    { id: 'ahp-session:/2d55', provider: 'claude', title: 'Advisor case 412 triage', status: SessionFlag.Error, dir: 'file:///brb_main/src/service_advisor' },
    { id: 'ahp-session:/4e18', provider: 'claude', title: 'Old build script cleanup', status: SessionFlag.Idle | SessionFlag.IsArchived | SessionFlag.IsRead, dir: 'file:///brb_main/src/brb_backend' },
  ]) {
    summaries.set(seed.id, {
      resource: seed.id,
      provider: seed.provider,
      title: seed.title,
      status: seed.status,
      createdAt: AT,
      modifiedAt: AT,
      workingDirectories: [seed.dir],
    });
    turns.set(seed.id, []);
  }

  // One session has a conversation already, because a transcript that is only
  // ever built by streaming never gets rendered from a snapshot - and a
  // snapshot is what every reader sees first.
  const seeded = 'ahp-session:/1f0a';
  turns.set(seeded, [
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
  ]);
  changesets.set(seeded, { status: 'complete', files: [] });

  // ------------------------------------------------------------------ scripts

  /** What the agent does when it is spoken to. */
  function reply(uri: SessionUri, said: string): void {
    const userTurn: Turn = { id: nextId('u'), role: 'user', message: said, parts: [], state: 'complete', at: AT };
    const agentTurn: Turn = { id: nextId('a'), role: 'agent', parts: [], state: 'running', model: 'claude-opus-5', at: AT };

    script.push(() => {
      turns.get(uri)?.push(userTurn);
      emit(uri, { type: 'turnStarted', turn: userTurn });
      active.set(uri, agentTurn);
      emit(uri, { type: 'turnStarted', turn: agentTurn });
      setStatus(uri, SessionFlag.InProgress | SessionFlag.IsRead);
    });

    const think = 'The composer swallows single-letter keys, so a global `q` cannot exist while it has focus. ';
    const part = (kind: 'markdown' | 'reasoning', id: string, text: string): void => {
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
    };

    part('reasoning', nextId('r'), think);
    part('markdown', nextId('m'), 'Two things are true at once here.\n\nThe **composer owns the keyboard** while it is focused, so every single-letter binding has to live in a focus scope rather than globally. What is left global is the modified set:\n\n- `ctrl+p` for the palette\n- `ctrl+c` to stop the turn\n\nLet me look at what the transcript does with the rest.');

    const readCall: ToolCall = {
      id: nextId('c'), name: 'Read', toolName: 'Read', status: 'running',
      input: 'packages/core/src/app/input.ts',
      intention: 'Read the input router, to see who gets a key first',
    };
    script.push(() => {
      const turn = active.get(uri);
      turn?.parts.push({ kind: 'toolCall', id: readCall.id, call: readCall });
      emit(uri, { type: 'toolCall', call: readCall });
    });
    script.push(() => {
      readCall.status = 'completed';
      readCall.outcome = 'Read 214 lines';
      readCall.output = 'const order = [layers, screen, surfaces, global];\n// A layer that traps focus gets the key before anything under it.';
      emit(uri, { type: 'toolCall', call: readCall });
    });

    // The blocked bit. Nothing after this runs until it is answered, which is
    // the honest shape: the agent is stopped, not slow.
    const bash: ToolCall = {
      id: nextId('c'), name: 'Bash', toolName: 'Bash', status: 'pending-confirmation',
      input: 'pnpm --filter @textui/core test -- input.test.ts',
      intention: 'Run the input router tests',
      confirmationTitle: 'Run a command in /github/textui?',
      options: [
        { id: 'once', label: 'Allow once' },
        { id: 'session', label: 'Allow for this session' },
      ],
    };
    script.push(() => {
      const turn = active.get(uri);
      turn?.parts.push({ kind: 'toolCall', id: bash.id, call: bash });
      emit(uri, { type: 'toolCall', call: bash });
      const input: PendingInput = { kind: 'toolConfirmation', id: nextId('i'), call: bash };
      inputs.set(uri, input);
      emit(uri, { type: 'inputNeeded', input });
      setStatus(uri, SessionFlag.InputNeeded | SessionFlag.IsRead);
    });
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
    script.push(() => {
      const input: PendingInput = {
        kind: 'chatInput',
        id: nextId('i'),
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
      };
      inputs.set(uri, input);
      emit(uri, { type: 'inputNeeded', input });
      setStatus(uri, SessionFlag.InputNeeded | SessionFlag.IsRead);
    });
  }

  function finish(uri: SessionUri, closing: string): void {
    const id = nextId('m');
    script.push(() => {
      const turn = active.get(uri);
      turn?.parts.push({ kind: 'markdown', id, content: '' });
    });
    for (const word of WORDS(closing)) {
      script.push(() => {
        const turn = active.get(uri);
        const found = turn?.parts.find((p) => p.id === id);
        if (found && found.kind === 'markdown') found.content += word;
        emit(uri, { type: 'delta', partId: id, kind: 'markdown', text: word });
      });
    }
    script.push(() => {
      const turn = active.get(uri);
      if (!turn) return;
      turn.state = 'complete';
      turn.elapsedMs = 18_200;
      turns.get(uri)?.push(turn);
      active.delete(uri);
      emit(uri, { type: 'turnComplete', turn });
      setStatus(uri, SessionFlag.Idle | SessionFlag.IsRead);

      const changes: Changeset = {
        status: 'complete',
        files: [
          { uri: 'file:///github/textui/examples/chat/src/control.ts', before: 'x', after: 'y', diff: { added: 34, removed: 6 } },
          { uri: 'file:///github/textui/examples/chat/test/keys.test.tsx', after: 'y', diff: { added: 51, removed: 0 } },
        ],
      };
      changesets.set(uri, changes);
      emit(uri, { type: 'changes', changes });
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
    id: 'local',
    url: 'ws://127.0.0.1:9187',
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

    createSession: async ({ provider, workingDirectory }) => {
      const uri = `ahp-session:/${(0x1000 + summaries.size).toString(16)}`;
      summaries.set(uri, {
        resource: uri,
        provider,
        title: 'New session',
        status: SessionFlag.Idle,
        createdAt: AT,
        modifiedAt: AT,
        workingDirectories: workingDirectory ? [`file://${workingDirectory}`] : [],
      });
      turns.set(uri, []);
      return uri;
    },

    disposeSession: async (uri) => {
      summaries.delete(uri);
      turns.delete(uri);
      active.delete(uri);
      inputs.delete(uri);
    },

    setArchived: (uri, archived) => {
      const summary = summaries.get(uri);
      if (!summary) return;
      const status = archived
        ? summary.status | SessionFlag.IsArchived
        : summary.status & ~SessionFlag.IsArchived;
      setStatus(uri, status);
    },

    subscribe: (uri, observer) => {
      let set = observers.get(uri);
      if (!set) { set = new Set(); observers.set(uri, set); }
      set.add(observer);
      const summary = summaries.get(uri);
      observer({
        type: 'snapshot',
        turns: turns.get(uri) ?? [],
        ...(active.get(uri) ? { active: active.get(uri) as Turn } : {}),
        ...(inputs.get(uri) ? { input: inputs.get(uri) as PendingInput } : {}),
        status: summary?.status ?? SessionFlag.Idle,
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
      setStatus(uri, SessionFlag.Idle | SessionFlag.IsRead);
    },

    confirmToolCall: (uri, toolCallId, approved) => {
      const input = inputs.get(uri);
      if (!input || input.kind !== 'toolConfirmation' || input.call.id !== toolCallId) return;
      inputs.delete(uri);
      emit(uri, { type: 'inputResolved' });
      setStatus(uri, SessionFlag.InProgress | SessionFlag.IsRead);
      afterApproval(uri, input.call, approved);
    },

    completeInput: (uri, requestId, accepted, answers) => {
      const input = inputs.get(uri);
      if (!input || input.id !== requestId) return;
      inputs.delete(uri);
      emit(uri, { type: 'inputResolved' });
      setStatus(uri, SessionFlag.InProgress | SessionFlag.IsRead);
      const chosen = answers.q1;
      const where = !accepted ? 'nothing'
        : chosen?.kind === 'selected' ? chosen.value
          : chosen?.kind === 'text' ? chosen.value : 'nothing';
      finish(uri, `Right - **${where}**. I will move the bindings and leave the modified keys where they are.`);
    },

    changes: async (uri) => changesets.get(uri) ?? { status: 'complete', files: [] },

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
