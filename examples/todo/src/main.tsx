import { WRITER_KEY, createApp } from '@textui/core';
import type { CapabilityOverrides, UnicodeLevel } from '@textui/core';
import {
  captureBuffer, createNodeTerminal, createVirtualTerminal, createWriter,
} from '@textui/terminal';
import { registerTodo } from './app.js';

/**
 * The entry point.
 *
 * Split from `app.tsx` so the example can be *mounted* without being *run*:
 * the smoke test registers the same thing into a harness, which is the only
 * way an example stays working.
 */

interface Options {
  static_: boolean;
  width: number;
  height: number;
  unicode?: UnicodeLevel;
  colors?: number;
}

function parse(argv: string[]): Options {
  const options: Options = {
    static_: false,
    width: process.stdout.columns ?? 100,
    height: process.stdout.rows ?? 30,
  };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--static': case '-s': options.static_ = true; break;
      case '--width': case '-w': options.width = Number(argv[++i]); break;
      case '--height': options.height = Number(argv[++i]); break;
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

/**
 * One frame, to stdout.
 *
 * A virtual terminal and a capture rather than a second rendering path: the
 * application that runs here is the application that runs on a tty, mounted
 * against a terminal that is a size and nothing else. What is printed is every
 * cell it painted.
 */
async function still(options: Options): Promise<void> {
  const terminal = createVirtualTerminal({
    width: options.width,
    height: options.height,
    capabilities: overrides(options),
  });
  const app = createApp({
    terminal,
    theme: 'workbench',
    shell: 'workbench',
    onBoot: (booted) => { registerTodo(booted); },
  });
  app.services.provide(WRITER_KEY, createWriter(terminal.capabilities()));
  await app.start();
  // Settle: a measured component only knows its size once it has been laid
  // out, and what it draws next depends on that.
  for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 4));
  app.flush();

  process.stdout.write(`${captureBuffer(app.buffer(), terminal.capabilities())}\n`);
  await app.stop();
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
    theme: 'workbench',
    shell: 'workbench',
    session: { managed: true, altScreen: true, mouse: true, title: 'todo' },
    onBoot: (booted) => {
      registerTodo(booted);
      booted.commands.register({
        id: 'app.quit',
        title: 'Quit',
        slots: ['palette'],
        run: () => void app.stop().then(() => process.exit(0)),
      });
      booted.keybindings.register({ keys: 'q', commandId: 'app.quit' });
      booted.keybindings.register({ keys: 'ctrl+c', commandId: 'app.quit' });
    },
  });

  app.services.provide(WRITER_KEY, createWriter(terminal.capabilities()));
  await app.start();
}

await main();
