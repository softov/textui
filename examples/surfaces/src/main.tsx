import { WRITER_KEY, createApp } from '@textui/core';
import type { CapabilityOverrides, UnicodeLevel } from '@textui/core';
import {
  captureBuffer, createNodeTerminal, createVirtualTerminal, createWriter,
} from '@textui/terminal';
import { Frame, registerSurfaces } from './app.js';

/**
 * The entry point.
 *
 * Split from `app.tsx` so the example can be mounted without being run: the
 * smoke test registers the same thing into a harness, which is the only way an
 * example stays working.
 *
 * Note what is *not* passed to `createApp`: no `shell`. The default is
 * `'plain'`, and since `registerSurfaces` registers no shells, nothing answers
 * to that name - so the runtime falls through to rendering `root` on a themed
 * canvas. That fall-through is the whole point of the example, and it is one
 * branch in `rootNode()`.
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
  const terminal = createVirtualTerminal({
    width: options.width,
    height: options.height,
    capabilities: overrides(options),
  });
  const app = createApp({
    terminal,
    theme: options.theme,
    root: { component: 'SurfacesFrame' },
    onBoot: (booted) => { registerSurfaces(booted); },
  });
  app.services.provide(WRITER_KEY, createWriter(terminal.capabilities()));
  await app.start();
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

  const terminal = createNodeTerminal({ capabilities: overrides(options) });
  const app = createApp({
    terminal,
    theme: options.theme,
    root: { component: 'SurfacesFrame' },
    session: { managed: true, altScreen: true, mouse: true, title: 'surfaces' },
    onBoot: (booted) => {
      registerSurfaces(booted);
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

// `Frame` is registered by the component that defines it; naming it here keeps
// the import from being elided as unused by a bundler that cannot see JSX.
void Frame;

await main();
