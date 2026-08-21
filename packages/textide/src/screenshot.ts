import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { TextUIApp } from '@textui/core';
import { captureBuffer } from '@textui/terminal';

/**
 * What the screen looked like, as a file.
 *
 * A terminal application has nowhere to print a diagnostic - the screen is the
 * output - and the next redraw erases the frame that was wrong. So a bug
 * report about layout is a photograph of a monitor, and a bug about a colour
 * is a description of one. This writes the live frame out instead: every cell
 * the runtime last painted, with its colours, in a file that `cat` replays.
 *
 * Two files, because they answer different questions. The `.ans` looks like
 * the screen. The `.txt` beside it is the same frame with the colour stripped,
 * which is the one a diff can read and a test can assert on.
 */
export interface ScreenshotOptions {
  /** Where the files go. Defaults to the working directory. */
  dir?: string;
  /** Base name, without an extension. Defaults to a counter. */
  name?: string;
  /** Also write the plain-text copy. On unless asked otherwise. */
  text?: boolean;
}

export interface Screenshot {
  ansi: string;
  text: string | null;
  /** What was captured, so a caller can log or assert on it without a read. */
  frame: string;
  width: number;
  height: number;
}

let counter = 0;

export async function takeScreenshot(
  app: TextUIApp,
  options: ScreenshotOptions = {},
): Promise<Screenshot> {
  const buffer = app.buffer();
  const capabilities = app.capabilities;
  const dir = resolve(options.dir ?? process.cwd());
  const base = options.name ?? `textide-${String(++counter).padStart(3, '0')}`;

  const coloured = captureBuffer(buffer, capabilities);
  const plain = captureBuffer(buffer, capabilities, { colors: false });

  const ansiPath = join(dir, `${base}.ans`);
  await mkdir(dirname(ansiPath), { recursive: true });
  // A trailing newline, so the shell prompt that follows a `cat` starts on its
  // own row rather than on the last row of the picture.
  await writeFile(ansiPath, `${coloured}\n`, 'utf8');

  let textPath: string | null = null;
  if (options.text !== false) {
    textPath = join(dir, `${base}.txt`);
    await writeFile(textPath, `${plain}\n`, 'utf8');
  }

  return {
    ansi: ansiPath,
    text: textPath,
    frame: plain,
    width: buffer.width,
    height: buffer.height,
  };
}
