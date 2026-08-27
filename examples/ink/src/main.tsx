import { WRITER_KEY, createApp } from '@textui/core';
import type { CapabilityOverrides, UnicodeLevel } from '@textui/core';
import { createNodeTerminal, createWriter, renderStill } from '@textui/terminal';
import { Frame, registerInk } from './app.js';

/**
 * The entry point.
 *
 * Split from `app.tsx` so the example can be mounted without being run: the
 * smoke test registers the same thing into a harness, which is the only way an
 * example stays working.
 *
 * `--colors 4` is the flag worth reaching for here. Every ink in the list is
 * 24-bit, and a terminal that can only show sixteen colours gets each of them
 * reduced to the nearest one it has - which is the honest preview of what an
 * ssh session makes of a six-stop ramp, and the reason none of this is ever
 * allowed to carry the meaning.
 */

interface Options {
  static_: boolean;
  width: number;
  height: number;
  unicode?: UnicodeLevel;
  colors?: number;
  theme: string;
}

function parse(argv: string[]): Options {
  const options: Options = {
    static_: false,
    width: process.stdout.columns ?? 100,
    height: process.stdout.rows ?? 30,
    theme: 'dark',
  };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--static': case '-s': options.static_ = true; break;
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

async function still(options: Options): Promise<void> {
  const { text } = await renderStill({
    width: options.width,
    height: options.height,
    capabilities: overrides(options),
    theme: options.theme,
    root: { component: 'InkFrame' },
    onBoot: (booted) => { registerInk(booted); },
  });
  process.stdout.write(`${text}\n`);
}

async function main(): Promise<void> {
  const options = parse(process.argv.slice(2));
  if (options.static_ || !process.stdout.isTTY) {
    await still(options);
    return;
  }

  const terminal = createNodeTerminal({ capabilities: overrides(options) });
  const app = createApp({
    terminal,
    theme: options.theme,
    root: { component: 'InkFrame' },
    session: { managed: true, altScreen: true, mouse: true, title: 'ink' },
    onBoot: (booted) => {
      registerInk(booted);
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
