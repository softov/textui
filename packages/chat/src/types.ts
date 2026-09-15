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
  status: ChatToolCallStatus;
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
}

/** The row under the composer: gone to the host, or never going. */
export interface ChatSendStatus {
  state: 'sending' | 'failed';
  text: string;
}
