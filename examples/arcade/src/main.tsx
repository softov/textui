import { WRITER_KEY, createApp } from '@textui/core';
import type { CapabilityOverrides, UnicodeLevel } from '@textui/core';
import {
  createNodeTerminal, createWriter, renderStill,
} from '@textui/terminal';
import { registerArcade } from './app.js';
import { SEED } from './data.js';
import { fileStore } from './storage.js';

/**
 * The entry point.
 *
 * Split from `app.tsx` so the arcade can be *mounted* without being *run* -
 * which is what lets the smoke test drive a game with a clock it controls.
 */

interface Options {
  static_: boolean;
  width: number;
  height: number;
  unicode?: UnicodeLevel;
  colors?: number;
  data: string;
  seed?: number;
  play?: string;
}

function parse(argv: string[]): Options {
  const options: Options = {
    static_: false,
    width: process.stdout.columns ?? 100,
    height: process.stdout.rows ?? 30,
    data: 'arcade.json',
  };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--static': case '-s': options.static_ = true; break;
      case '--width': case '-w': options.width = Number(argv[++i]); break;
      case '--height': options.height = Number(argv[++i]); break;
      case '--unicode': options.unicode = argv[++i] as UnicodeLevel; break;
      case '--colors': options.colors = Number(argv[++i]); break;
      case '--data': options.data = argv[++i] as string; break;
      // The same game twice, for a bug that only happens on one board.
      case '--seed': options.seed = Number(argv[++i]); break;
      // Open straight into a game. For a still of a game rather than of the
      // cabinet, which is the only picture worth taking.
      case '--play': options.play = argv[++i] as string; break;
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

/** One frame, to stdout: the cabinet, or a game with `--play`. */
async function still(options: Options): Promise<void> {
  const { text } = await renderStill({
    width: options.width,
    height: options.height,
    capabilities: overrides(options),
    theme: 'console',
    shell: 'plain',
    onBoot: (booted) => {
      registerArcade(booted);
      if (options.seed !== undefined) booted.store.set(SEED, options.seed);
    },
    // A game is worth a picture only once it is running.
    before: async (app) => {
      if (options.play) await app.execute('arcade.play', { gameId: options.play });
    },
  });
  process.stdout.write(`${text}\n`);
}

async function main(): Promise<void> {
  const options = parse(process.argv.slice(2));
  if (options.static_ || !process.stdout.isTTY) {
    await still(options);
    return;
  }

  const terminal = createNodeTerminal();
  const app = createApp({
    terminal,
    theme: 'console',
    shell: 'plain',
    session: { managed: true, altScreen: true, mouse: true, title: 'arcade' },
    onBoot: (booted) => {
      registerArcade(booted, {
        // What Ctrl+C does in the cabinet. It lives here rather than in
        // `app.tsx` because leaving the process is the entry point's business
        // and a host that embeds the arcade has its own answer.
        onQuit: () => void app.stop().then(() => process.exit(0)),
      });
      booted.store.registerPersistence(fileStore({ path: options.data }));
      if (options.seed !== undefined) booted.store.set(SEED, options.seed);
    },
  });

  app.services.provide(WRITER_KEY, createWriter(terminal.capabilities()));
  await app.start();
  if (options.play) await app.execute('arcade.play', { gameId: options.play });
}

await main();
