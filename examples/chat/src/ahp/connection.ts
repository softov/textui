import type {
  Agent, Answer, Changeset, PendingInput, SessionConfig, SessionSummary, SessionUri,
  ToolCall, Turn,
} from './types.js';

/**
 * What a chat client needs from an agent host.
 *
 * A host is a *sessions server*: several clients watch and drive the same
 * sessions and none of them owns the process running the agent. So everything
 * here is either a question about state the host owns, or a fire-and-forget
 * dispatch - there is no local "send and append what I sent". The turn appears
 * when the host has reduced it, which is why the UI re-reads rather than
 * echoing.
 *
 * This is the seam. `fakeHost` implements it with a scripted agent so the
 * example runs, and is checked, with nothing installed; a real client
 * implements the same shape over a WebSocket and changes nothing above it.
 */
export interface HostConnection {
  readonly id: string;
  readonly url: string;
  state(): 'connecting' | 'connected' | 'offline';

  /** The catalogue. Deliberately thin - everything else is on the channel. */
  listSessions(): Promise<SessionSummary[]>;
  /** The harnesses the host advertises, and the models each offers. */
  agents(): Promise<Agent[]>;

  createSession(options: { provider: string; workingDirectory?: string }): Promise<SessionUri>;
  disposeSession(uri: SessionUri): Promise<void>;
  setArchived(uri: SessionUri, archived: boolean): void;

  /**
   * Subscribe to a session: a snapshot, then an ordered stream of what happens.
   *
   * Closing the returned handle drops *this consumer*, and a second subscribe
   * on a channel already being drained must not unsubscribe it - that is
   * channel-wide, and silently kills the stream everything else is reading.
   */
  subscribe(uri: SessionUri, observer: (event: HostEvent) => void): { close(): void };

  /** Begin a turn. Any turn - this is not only how the first one starts. */
  say(uri: SessionUri, text: string, model?: string): void;
  stopTurn(uri: SessionUri): void;

  /** Answer a tool confirmation. */
  confirmToolCall(uri: SessionUri, toolCallId: string, approved: boolean, optionId?: string): void;
  /** Answer a question. An accept with no answers resumes the agent on none. */
  completeInput(uri: SessionUri, requestId: string, accepted: boolean, answers: Record<string, Answer>): void;

  changes(uri: SessionUri): Promise<Changeset>;

  /** What this session can be told to do differently. */
  config(uri: SessionUri): Promise<SessionConfig>;
  /**
   * Change one key.
   *
   * The action merges into `config.values`, so sending the whole object writes
   * back everything this client happened to be holding - including a value
   * another client changed while the page had it on screen.
   */
  setConfig(uri: SessionUri, key: string, value: string): void;
}

/**
 * What the host says happened.
 *
 * Named after the actions rather than after what a screen does with them: the
 * host is describing its own state changing, and a client that renamed
 * `chat/delta` to `appendToBubble` would have written the UI into the wire.
 */
export type HostEvent =
  | { type: 'snapshot'; turns: Turn[]; active?: Turn; input?: PendingInput; status: number }
  | { type: 'turnStarted'; turn: Turn }
  | { type: 'delta'; partId: string; kind: 'markdown' | 'reasoning'; text: string }
  | { type: 'toolCall'; call: ToolCall }
  | { type: 'inputNeeded'; input: PendingInput }
  | { type: 'inputResolved' }
  | { type: 'turnComplete'; turn: Turn }
  | { type: 'status'; status: number }
  | { type: 'changes'; changes: Changeset };
