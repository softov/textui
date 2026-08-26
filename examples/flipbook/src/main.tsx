import { readFile } from 'node:fs/promises';
import { WRITER_KEY, createApp } from '@textui/core';
import type { CapabilityOverrides, UnicodeLevel } from '@textui/core';
import {
  captureBuffer, createNodeTerminal, createVirtualTerminal, createWriter,
} from '@textui/terminal';
import { Frame, loaded, registerFlipbook } from './app.js';
import type { MotionDocument } from './motion.js';
import { parse, serialise } from './motion.js';
import { SAMPLE } from './sample.js';

/**
 * The entry point.
 *
 * `--file` takes any ASCII Motion export; with none, the bundled sample runs,
 * so the example works before you have a document of your own. Mouse is on in
 * the session options - without it a click cannot place the cursor, and that
 * is half of the editing story.
 */

interface Options {
  static_: boolean;
  width: number;
  height: number;
  file?: string;
  edit: boolean;
  unicode?: UnicodeLevel;
  colors?: number;
  theme: string;
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    static_: false,
    width: process.stdout.columns ?? 100,
    height: process.stdout.rows ?? 30,
    theme: 'dark',
    edit: false,
  };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--static': case '-s': options.static_ = true; break;
      case '--file': case '-f': options.file = argv[++i]; break;
      case '--edit': case '-e': options.edit = true; break;
      case '--width': case '-w': options.width = Number(argv[++i]); break;
      case '--height': options.height = Number(argv[++i]); break;
      case '--unicode': options.unicode = argv[++i] as UnicodeLevel; break;
      case '--colors': options.colors = Number(argv[++i]); break;
      case '--theme': options.theme = argv[++i] as string; break;
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

async function loadMovie(file?: string): Promise<void> {
  const doc: MotionDocument = file
    ? (JSON.parse(await readFile(file, 'utf8')) as MotionDocument)
    : SAMPLE;
  loaded.movie = parse(doc);
  loaded.path = file ?? null;
  // The baseline the footer compares against, so "modified" means modified
  // rather than "opened".
  loaded.saved = serialise(loaded.movie);
}

async function still(options: Options): Promise<void> {
  const terminal = createVirtualTerminal({
    width: options.width,
    height: options.height,
    capabilities: overrides(options),
  });
  const app = createApp({
    terminal,
    theme: options.theme,
    root: { component: 'FlipbookFrame' },
    onBoot: (booted) => { registerFlipbook(booted); },
  });
  app.services.provide(WRITER_KEY, createWriter(terminal.capabilities()));
  await app.start();
  for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 4));
  app.flush();
  process.stdout.write(`${captureBuffer(app.buffer(), terminal.capabilities())}\n`);
  await app.stop();
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  loaded.mode = options.edit ? 'edit' : 'view';
  try {
    await loadMovie(options.file);
  } catch (err) {
    process.stderr.write(`flipbook: ${String(err)}\n`);
    process.exit(1);
  }

  if (options.static_ || !process.stdout.isTTY) {
    await still(options);
    return;
  }

  const terminal = createNodeTerminal({ capabilities: overrides(options) });
  const app = createApp({
    terminal,
    theme: options.theme,
    root: { component: 'FlipbookFrame' },
    session: { managed: true, altScreen: true, mouse: true, title: 'flipbook' },
    onBoot: (booted) => {
      registerFlipbook(booted);
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

// `Frame` is registered by name, so nothing here imports it as a value; this
// keeps a bundler from eliding the module that defines it.
void Frame;

await main();
