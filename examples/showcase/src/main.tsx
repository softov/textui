import { writeFile } from 'node:fs/promises';
import { WRITER_KEY, createApp } from '@textui/core';
import type { CapabilityOverrides, UnicodeLevel } from '@textui/core';
import {
  bufferToSvg, captureBuffer, createNodeTerminal, createVirtualTerminal, createWriter,
} from '@textui/terminal';
import { registerShowcase } from './screen.js';

/**
 * The entry point.
 *
 * Two ways out, and the second is the reason the example exists: run it and it
 * is an application, or ask for a still and it is a file. `--svg` is the one
 * that ends up in a README, because an `.ans` capture is only a screenshot on
 * a terminal and a repository page is not one.
 */

interface Options {
  static_: boolean;
  width: number;
  /**
   * Left off for a still, and that is the interesting case.
   *
   * A picture is as tall as what is in it, and nobody knows that up front: it
   * depends on the width, on `--wrap`, and on how tall each panel came out. So
   * a still with no height renders into a deliberately over-tall terminal and
   * crops back to the rows that were used.
   */
  height?: number;
  wrap: number;
  theme: string;
  only?: string;
  svg?: string;
  unicode?: UnicodeLevel;
  colors?: number;
}

function parse(argv: string[]): Options {
  const options: Options = {
    static_: false,
    width: process.stdout.columns ?? 132,
    // Three panels across, which is what 40 buys at about 130 cells. Also the
    // number that makes the wrapping visible at a normal terminal size: much
    // wider and it never wraps, much narrower and it is always one column.
    wrap: 40,
    theme: 'dark',
  };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--static': case '-s': options.static_ = true; break;
      case '--width': case '-w': options.width = Number(argv[++i]); break;
      case '--height': options.height = Number(argv[++i]); break;
      case '--wrap': options.wrap = Number(argv[++i]); break;
      case '--theme': options.theme = String(argv[++i]); break;
      case '--only': options.only = String(argv[++i]); break;
      case '--svg': options.svg = String(argv[++i]); break;
      case '--unicode': options.unicode = argv[++i] as UnicodeLevel; break;
      case '--colors': options.colors = Number(argv[++i]); break;
      default: break;
    }
  }
  return options;
}

function overrides(options: Options): CapabilityOverrides {
  return {
    ...(options.unicode ? { unicode: options.unicode, wideChars: options.unicode !== 'ascii' } : {}),
    ...(options.colors !== undefined ? { colorDepth: options.colors as 0 | 4 | 8 | 24 } : {}),
  };
}

async function still(options: Options): Promise<void> {
  // Tall enough that nothing can be cut, then cropped back to what was used.
  // The alternative is asking for a height and getting a picture with the last
  // row of panels missing, which is the shape of every screenshot mistake.
  const fit = options.height === undefined;
  const terminal = createVirtualTerminal({
    width: options.width,
    height: options.height ?? 400,
    capabilities: overrides(options),
  });
  const app = createApp({
    terminal,
    theme: options.theme,
    onBoot: (booted) => {
      registerShowcase(booted, {
        wrap: options.wrap,
        ...(options.only !== undefined ? { only: options.only } : {}),
        ...(fit ? { fit: true } : {}),
      });
    },
  });
  app.services.provide(WRITER_KEY, createWriter(terminal.capabilities()));
  await app.start();

  // A frame or two, because a panel that measures itself is a frame behind by
  // design - the layout decides the width and the content is drawn to it on
  // the pass after. Without this the first still is the unwrapped one.
  for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 4));
  app.flush();

  // `resize` keeps the top-left region, so shrinking it is a crop. Done to the
  // app's own buffer because the next thing to happen to it is `stop`.
  if (fit) app.buffer().resize(options.width, lastUsedRow(app.buffer()));

  if (options.svg !== undefined) {
    await writeFile(options.svg, `${bufferToSvg(app.buffer(), {
      // The theme's own colours rather than the exporter's defaults: a cell
      // left at the terminal default means "whatever the emulator is set to",
      // and the honest answer for a picture of this screen is the background
      // it was drawn against.
      background: app.theme.colors.canvas,
      foreground: app.theme.colors.text,
      title: `textui - ${options.theme}`,
    })}\n`, 'utf8');
    process.stderr.write(`${options.svg}\n`);
  } else {
    process.stdout.write(`${captureBuffer(app.buffer(), terminal.capabilities())}\n`);
  }
  await app.stop();
}

/**
 * How many rows have something on them.
 *
 * By character rather than by colour: a theme paints its canvas into every
 * cell it is given, so "has a background" is true of the whole terminal and
 * says nothing about where the content stopped.
 */
function lastUsedRow(buffer: {
  width: number;
  height: number;
  get(x: number, y: number): { char: string } | undefined;
}): number {
  for (let y = buffer.height - 1; y >= 0; y--) {
    for (let x = 0; x < buffer.width; x++) {
      if ((buffer.get(x, y)?.char ?? ' ').trim() !== '') return y + 1;
    }
  }
  return 1;
}

async function main(): Promise<void> {
  const options = parse(process.argv.slice(2));
  // No tty is a still whether or not anybody asked: piping this somewhere and
  // getting an application that has taken the alternate screen is the shape of
  // a hang.
  if (options.static_ || options.svg !== undefined || !process.stdout.isTTY) {
    await still(options);
    return;
  }

  const terminal = createNodeTerminal();
  const app = createApp({
    terminal,
    theme: options.theme,
    session: { managed: true, altScreen: true, mouse: true, title: 'textui' },
    onBoot: (booted) => {
      registerShowcase(booted, {
        wrap: options.wrap,
        ...(options.only !== undefined ? { only: options.only } : {}),
      });
      booted.commands.register({
        id: 'app.quit',
        title: 'Quit',
        slots: ['palette'],
        run: () => void app.stop().then(() => process.exit(0)),
      });
      booted.keybindings.register({ keys: 'ctrl+c', commandId: 'app.quit' });
    },
  });

  app.services.provide(WRITER_KEY, createWriter(terminal.capabilities()));
  await app.start();
}

void main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});
