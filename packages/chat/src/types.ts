/**
 * What the chat components are told, in the components' own words.
 *
 * These are view shapes, not a protocol. A client that speaks AHP, or
 * anything else, maps its own records onto them and the components never
 * learn where a session or a tool call came from. The field names follow the
 * Agent Host Protocol's where one exists, so that mapping is a pick rather
 * than a rename - but nothing here is imported from it, and nothing here
 * says how a session is fetched.
 */

export type ChatToolCallStatus =
  | 'pending' | 'pending-confirmation' | 'running' | 'completed' | 'failed' | 'cancelled';

/** One tool call, flat: the fields that are not there yet are absent. */
export interface ChatToolCall {
  id: string;
  /** What the row calls it. */
  name: string;
  /**
   * The tool's own id, where it differs from the display name.
   *
   * Hosts give many tools one display name - every subagent is "Explore" or
   * "Plan" and the tool under all of them is `Task` - and a person searching
   * the transcript for the one or the other should find the row either way.
   */
  toolName?: string;
  status: ChatToolCallStatus;
  /** The command. The only thing separating twenty identical rows. */
  input?: string;
  /** What it meant to do. Markdown. */
  intention?: string;
  /**
   * What it is doing right now, while it runs.
   *
   * A line drawn on a running row and dropped when the row ends: a
   * subagent's own summary of how far it has got, the last tool it reached
   * for. Read only while `running`; a host that leaves it on a finished call
   * is still describing a state the call is no longer in.
   */
  progress?: string;
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

export type ChatActivity = 'input' | 'running' | 'error' | 'idle';

/**
 * A session's state, already decoded.
 *
 * The word, the colour and the glyph travel together because none of them is
 * allowed to be the only carrier: a piped log keeps the word, a 16-colour
 * terminal keeps the glyph, and a reader who cannot see the colour keeps both.
 */
export interface ChatSessionStatus {
  activity: ChatActivity;
  archived: boolean;
  read: boolean;
  label: string;
  tone: 'warning' | 'accent' | 'danger' | 'muted';
  glyph: 'bulletHalf' | 'bulletFilled' | 'cross' | 'bulletHollow';
}

/** One row of the catalogue, and the head over a conversation. */
export interface ChatSession {
  id: string;
  title: string;
  /** Which harness runs it. */
  provider: string;
  status: ChatSessionStatus;
  createdAt: string;
  modifiedAt: string;
  workingDirectories: string[];
  /** The project as the host names it, when it does. */
  project?: string;
  branch?: string;
  /**
   * The pull request the branch became, as the row says it: `#412 merged`.
   *
   * Already a label. Which host key holds the number and which the state is
   * the client's to know; the row only has one line to say it on.
   */
  pullRequest?: string;
  /** What the host says it is doing, in its own words. */
  activity?: string;
  /** Why it is here when nobody started it, as a phrase: "by an automation". */
  origin?: string;
  changes?: { files?: number; additions?: number; deletions?: number };
}

export type ChatQuestionKind =
  | 'text' | 'number' | 'integer' | 'boolean' | 'single-select' | 'multi-select';

export interface ChatQuestion {
  id: string;
  kind: ChatQuestionKind;
  message: string;
  required?: boolean;
  options?: { id: string; label: string }[];
  /** Answering in words *instead of* choosing, not as a choice. */
  allowFreeformInput?: boolean;
}

export type ChatAnswer =
  | { kind: 'text'; value: string }
  | { kind: 'number'; value: number }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'selected'; value: string }
  | { kind: 'selected-many'; value: string[] };

/** A yes or a no about a command, with named options where there are any. */
export interface ChatToolConfirmation {
  kind: 'toolConfirmation';
  id: string;
  call: ChatToolCall;
}

/** A request in prose, with the questions under it. */
export interface ChatInputRequest {
  kind: 'chatInput';
  id: string;
  message: string;
  questions: ChatQuestion[];
}

export type ChatPendingInput = ChatToolConfirmation | ChatInputRequest;

/** One entry of the path menu under the composer. */
export interface ChatCompletion {
  /** What to put in the draft. */
  insertText: string;
  /** Where the replaced fragment starts, as an offset into the draft. */
  rangeStart: number;
  /** Where it ends. */
  rangeEnd: number;
  /** What a person reads in the menu. */
  label: string;
  /** One line under it, when there is something worth reading. */
  description?: string;
}

/** One entry of the slash menu. */
export interface ChatCommand {
  id: string;
  kind: 'client' | 'session';
  title: string;
  description?: string;
  /** Where a session command came from: the plugin or directory. */
  from?: string;
  /**
   * What goes after the name, written the way it would be typed.
   *
   * `/autocompact <tokens>` says more about the command than a sentence
   * describing it, and it is the one thing a menu cannot show in a row: the
   * row is the name.
   */
  hint?: string;
}

/** The row under the composer: gone to the host, or never going. */
export interface ChatSendStatus {
  state: 'sending' | 'failed';
  text: string;
}
