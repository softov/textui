import type {
  CapabilityOverrides, CellBuffer, CreateAppOptions, TextUIApp,
} from '@textui/core';
import { WRITER_KEY, createApp } from '@textui/core';
import { createVirtualTerminal } from './virtual.js';
import { createWriter } from './writer.js';
import { captureBuffer } from './capture.js';
import type { CaptureOptions } from './capture.js';

/**
 * One frame of an application, as text.
 *
 * The same application, not a second rendering path: it is mounted against a
 * terminal that is a size and nothing else, rendered until it stops changing,
 * and every cell it painted is what comes back. Which is what a program does
 * when its output is a pipe rather than a screen - there is no frame after
 * this one to correct it, so it has to be the finished picture.
 *
 * Every example in this repository had written this out by hand, and all of
 * them ended the same way: a sleep loop of four milliseconds times a number
 * somebody had tried until the picture looked right. Eight, mostly - four in
 * one, twelve in another - for the same eight lines of setup either side. The
 * number was the tell. Nobody knew it, a small one silently writes a
 * half-drawn frame, and `TextUIApp.settled` is the answer they were all
 * approximating.
 */
export interface StillOptions extends Omit<CreateAppOptions, 'terminal' | 'session'> {
  /** Columns. The terminal is only a size, so this is the whole of it. */
  width?: number;
  height?: number;
  /** What the terminal should claim to be able to do. */
  capabilities?: CapabilityOverrides;
  /**
   * Drive it before the frame is taken.
   *
   * A still of an application in its opening state is the least interesting
   * one. This is where a screen is pushed, a message sent, or a scripted host
   * pumped to the point worth photographing - and it may be async, because
   * most of those are.
   */
  before?(app: TextUIApp): void | Promise<void>;
  /**
   * The frame is drawn and the application is still alive.
   *
   * For what a string cannot carry and `stop` would take away: the buffer, to
   * crop it to the rows that were used, and the theme, whose two colours are
   * the honest background for a picture of *this* screen rather than the
   * exporter's guess. It runs before the capture, so a buffer changed here is
   * the buffer that comes back as `text`.
   */
  after?(app: TextUIApp): void | Promise<void>;
  /** Plain text or SGR, and at what depth. Defaults to what the terminal claims. */
  capture?: CaptureOptions;
  /** Settle passes before giving up. See `TextUIApp.settled`. */
  settleLimit?: number;
}

export interface Still {
  /** Every cell it painted, rows separated by newlines. */
  text: string;
  /**
   * The cells themselves, for anything text cannot carry - `bufferToSvg`, a
   * pixel diff, an assertion about one cell's colour. Valid after the
   * application has stopped: nothing writes to it again.
   */
  buffer: CellBuffer;
  /**
   * Whether it went quiet, or the limit ran out first.
   *
   * An application that animates settles between its frames, so this is
   * `true` for one of those and the picture is a photograph of something
   * moving. `false` means the passes never stopped producing work - a render
   * loop that does not converge - and the frame was taken anyway, because a
   * still is better evidence of that than nothing is.
   */
  settled: boolean;
}

export async function renderStill(options: StillOptions = {}): Promise<Still> {
  const {
    width = 80, height = 24, capabilities, before, after, capture, settleLimit, ...app
  } = options;

  const terminal = createVirtualTerminal({
    width,
    height,
    ...(capabilities ? { capabilities } : {}),
  });

  const created = createApp({ ...app, terminal });
  // The writer is provided even though the buffer is what is read: a virtual
  // terminal records what was written to it, and a still that quietly stopped
  // producing that would break anything reading the bytes rather than the
  // cells.
  created.services.provide(WRITER_KEY, createWriter(terminal.capabilities()));

  await created.start();
  await before?.(created);

  const settled = await created.settled(settleLimit === undefined ? {} : { limit: settleLimit });
  // Even when it did not settle: the limit means "stop waiting", not "give up
  // on the frame", and a still of a moving thing is still a still.
  created.flush();
  await after?.(created);

  const text = captureBuffer(created.buffer(), terminal.capabilities(), capture ?? {});
  const buffer = created.buffer();
  await created.stop();

  return { text, buffer, settled };
}
