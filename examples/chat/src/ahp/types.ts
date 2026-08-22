/**
 * The protocol, as a client reads it.
 *
 * These are AHP's own names for AHP's own shapes - `SessionSummary.status` is
 * the bitset the host sends, `responseParts` is one ordered stream, a pending
 * input is either a tool confirmation or a question. Renaming them here would
 * only mean translating twice, and the whole point of the example is to find
 * out which components the *protocol's* shapes need.
 *
 * It is a subset: what a chat client has to render. The authority is the
 * `@agent-host-protocol` package's own `src/types/`.
 */

/** `ahp-session:/<uuid>`, or whatever scheme the provider registered. */
export type SessionUri = string;

/**
 * Status is activity and client flags in one number.
 *
 * `InputNeeded` carries `InProgress`, so it has to be tested first - a turn
 * waiting on a confirmation otherwise reads as merely running, and nobody
 * goes to answer it.
 */
export const SessionFlag = {
  Idle: 1,
  Error: 2,
  InProgress: 8,
  InputNeeded: 24,
  IsRead: 32,
  IsArchived: 64,
} as const;

export interface SessionSummary {
  resource: SessionUri;
  provider: string;
  title: string;
  status: number;
  createdAt: string;
  modifiedAt: string;
  workingDirectories: string[];
}

export type ToolCallStatus =
  | 'pending' | 'pending-confirmation' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * One tool call, flattened.
 *
 * `ToolCallState` is a union of eight states whose fields differ by state.
 * A reader wants one shape, so the union is flattened on the way in and the
 * fields that are not there yet are simply absent.
 */
export interface ToolCall {
  id: string;
  /** What the host calls it. */
  name: string;
  /** Kept apart: hosts give many tools one display name. */
  toolName: string;
  status: ToolCallStatus;
  /** The command. The only thing separating twenty identical rows. */
  input?: string;
  /** What it meant to do. Markdown. */
  intention?: string;
  /** What it did, past tense. */
  outcome?: string;
  /** What came back. */
  output?: string;
  exitCode?: number;
  files?: string[];
  /** Set while `pending-confirmation`. */
  confirmationTitle?: string;
  options?: { id: string; label: string }[];
}

export type ResponsePart =
  | { kind: 'markdown'; id: string; content: string }
  | { kind: 'reasoning'; id: string; content: string }
  | { kind: 'systemNotification'; id: string; content: string }
  | { kind: 'toolCall'; id: string; call: ToolCall };

/**
 * A turn.
 *
 * `parts` is one ordered stream, not prose and calls kept apart: "let me search
 * for those" means something before the searches and nothing after them.
 *
 * The running turn is `activeTurn` on the chat and is *not* in `turns` until it
 * finishes, so a client that reads only the history shows an empty conversation
 * for exactly as long as somebody is watching one happen.
 */
export interface Turn {
  id: string;
  role: 'user' | 'agent';
  /** What the person sent, on a user turn. */
  message?: string;
  parts: ResponsePart[];
  state: 'running' | 'complete' | 'cancelled' | 'failed';
  model?: string;
  at: string;
  elapsedMs?: number;
}

export type QuestionKind =
  | 'text' | 'number' | 'integer' | 'boolean' | 'single-select' | 'multi-select';

export interface Question {
  id: string;
  kind: QuestionKind;
  message: string;
  required?: boolean;
  options?: { id: string; label: string }[];
  /** Answering in words *instead of* choosing, not as a choice. */
  allowFreeformInput?: boolean;
}

/**
 * What the agent is waiting for.
 *
 * Two kinds, and they are nothing alike. A confirmation is a yes or a no about
 * a tool call. A question carries no tool call at all - its prose is the
 * request's message and what is being asked is its questions. Rendering the
 * second as the first loses the entire request: the choices vanish and what is
 * left on screen is a heading and an Approve button.
 */
export type PendingInput =
  | { kind: 'toolConfirmation'; id: string; call: ToolCall }
  | { kind: 'chatInput'; id: string; message: string; questions: Question[] };

/** Keyed by question id. The value names its own kind. */
export type Answer =
  | { kind: 'text'; value: string }
  | { kind: 'number'; value: number }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'selected'; value: string }
  | { kind: 'selected-many'; value: string[] };

export interface FileEdit {
  uri: string;
  /** Absent `before` is a creation, absent `after` a deletion. */
  before?: string;
  after?: string;
  diff: { added: number; removed: number };
}

export interface Changeset {
  status: 'computing' | 'complete';
  files: FileEdit[];
}

/** What `ahp-root://` advertises: the harnesses, and the models each offers. */
export interface Agent {
  provider: string;
  displayName: string;
  description?: string;
  models: { id: string; displayName: string; thinkingLevels?: string[] }[];
}

/**
 * A session's configuration, as the host describes it.
 *
 * The host sends a JSON Schema with titles, `enumLabels` and
 * `enumDescriptions`; this is that, flattened to what a form needs.
 * `sessionMutable` is the property that decides whether a control is offered
 * at all: `permissionMode` can be changed on a running session and `isolation`
 * cannot, and a form that lets you try produces a refusal instead of an edit.
 */
export interface ConfigProperty {
  key: string;
  title: string;
  description?: string;
  values: { value: string; label: string; description?: string }[];
  sessionMutable: boolean;
}

export interface SessionConfig {
  properties: ConfigProperty[];
  /** What is in force. A change dispatches the one key, never the object. */
  values: Record<string, string>;
}
