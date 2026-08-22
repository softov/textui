import { WRITER_KEY, createApp } from '@textui/core';
import type { CapabilityOverrides, UnicodeLevel } from '@textui/core';
import {
  captureBuffer, createNodeTerminal, createVirtualTerminal, createWriter,
} from '@textui/terminal';
import { registerChat } from './app.js';
import { CONTROLLER } from './control.js';
import { fakeHost } from './ahp/fake.js';

/**
 * The entry point.
 *
 * Split from `app.tsx` so the example can be *mounted* without being *run*.
 * What is here and not there: the terminal, the quit key, and the clock - the
 * scripted host is driven by a timer here and by a test's own loop there,
 * which is what makes streaming testable at all.
 */

interface Options {
  static_: boolean;
  width: number;
  height: number;
  unicode?: UnicodeLevel;
  colors?: number;
  /** Milliseconds a scripted word takes to arrive. */
  tick: number;
  /** Run the script to the end before the first frame, for a still. */
  settled: boolean;
  /** Or exactly this many scripted words, for a still of a turn mid-flight. */
  pump?: number;
  screen: string;
  session?: string;
  /** Say something on the open session before the frame is taken. */
  say?: string;
  /** Answer the confirmation the script stops at, to reach the question. */
  approve: boolean;
  /** ...and then answer the question, to reach the end of the turn. */
  answer: boolean;
}

function parse(argv: string[]): Options {
  const options: Options = {
    static_: false,
    width: process.stdout.columns ?? 100,
    height: process.stdout.rows ?? 30,
    tick: 40,
    settled: false,
    screen: 'sessions',
    approve: false,
    answer: false,
  };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--static': case '-s': options.static_ = true; break;
      case '--width': case '-w': options.width = Number(argv[++i]); break;
      case '--height': options.height = Number(argv[++i]); break;
      case '--unicode': options.unicode = argv[++i] as UnicodeLevel; break;
      case '--colors': options.colors = Number(argv[++i]); break;
      case '--tick': options.tick = Number(argv[++i]); break;
      case '--settled': options.settled = true; break;
      case '--pump': options.pump = Number(argv[++i]); break;
      case '--say': options.say = String(argv[++i]); break;
      case '--approve': options.approve = true; break;
      case '--answer': options.answer = true; break;
      case '--screen': options.screen = String(argv[++i]); break;
      case '--session': options.session = String(argv[++i]); break;
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

/** One frame, to stdout. The same application, against a terminal that is a size. */
async function still(options: Options): Promise<void> {
  const terminal = createVirtualTerminal({
    width: options.width,
    height: options.height,
    capabilities: overrides(options),
  });
  const host = fakeHost();
  const app = createApp({
    terminal,
    theme: 'workbench',
    shell: 'workbench',
    onBoot: (booted) => { registerChat(booted, { host }); },
  });
  app.services.provide(WRITER_KEY, createWriter(terminal.capabilities()));
  await app.start();

  const controller = app.services.require(CONTROLLER);
  if (options.session) {
    controller.open(options.session);
    if (options.screen !== 'sessions') app.screens.push(options.screen);
  }
  if (options.say) controller.send(options.say);

  // A still of a turn mid-flight is what `--pump` is for: run a fixed number
  // of scripted words rather than all of them, and the caret is wherever the
  // agent had got to. `--settled` runs until the script has nothing left it
  // can do without being answered, which is how the confirmation is reached.
  const steps = options.pump ?? (options.settled ? 100_000 : 0);
  for (let i = 0; i < steps; i++) if (!host.pump()) break;
  if (options.approve) {
    controller.approve();
    for (let i = 0; i < 100_000; i++) if (!host.pump()) break;
  }
  if (options.answer) {
    controller.answer({ q1: { kind: 'selected', value: 'transcript-scope' } }, true);
    for (let i = 0; i < 100_000; i++) if (!host.pump()) break;
  }

  for (let i = 0; i < 12; i++) await new Promise((r) => setTimeout(r, 4));
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
  const host = fakeHost();
  const app = createApp({
    terminal,
    theme: 'workbench',
    shell: 'workbench',
    session: { managed: true, altScreen: true, mouse: true, title: 'assistant' },
    onBoot: (booted) => {
      registerChat(booted, { host });
      booted.commands.register({
        id: 'app.quit',
        title: 'Quit',
        slots: ['palette'],
        run: () => void app.stop().then(() => process.exit(0)),
      });
      // `q` is *not* bound. The focused composer would take it first anyway,
      // but a quit key that exists only where it happens to be unread is a
      // quit key nobody can rely on - so it is ctrl+c and the palette.
      //
      // `ctrl+c` is registered for the turn *and* for this, in that order:
      // while something is running it stops it, and when nothing is, the
      // first binding does not apply and this one does. Cancel what is
      // happening, or leave if nothing is - which is what the key means
      // everywhere else.
      booted.keybindings.register({ keys: 'ctrl+c', commandId: 'app.quit' });
      booted.keybindings.register({ keys: 'ctrl+q', commandId: 'app.quit' });
    },
  });

  app.services.provide(WRITER_KEY, createWriter(terminal.capabilities()));
  await app.start();

  // The clock. A real connection has a socket pushing actions; the scripted
  // one has this, and everything above it cannot tell the difference.
  const timer = setInterval(() => { host.pump(); }, Math.max(1, options.tick));
  timer.unref?.();
}

await main();
