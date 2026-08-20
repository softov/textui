import { createApp, registerBuiltins, renderToString, WRITER_KEY } from '@textui/core';
import { createNodeTerminal, createWriter } from '@textui/terminal';
import { PLAYGROUNDS, findPlayground, setupPlayground } from './registry.js';
import { fixtures } from './data.js';

/**
 * The runner.
 *
 * `pnpm dev <id>` opens one playground; `--static` renders it once to stdout,
 * which is how a playground gets checked in CI and how it stays useful when
 * stdout is a pipe rather than a terminal.
 */

interface Options {
  id: string | null;
  list: boolean;
  static_: boolean;
  width: number;
  height: number;
  theme?: string;
  shell?: string;
  ascii: boolean;
  mono: boolean;
  noAnimations: boolean;
}

function parse(argv: string[]): Options {
  const options: Options = {
    id: null,
    list: false,
    static_: false,
    width: process.stdout.columns ?? 100,
    height: process.stdout.rows ?? 30,
    ascii: false,
    mono: false,
    noAnimations: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i] as string;
    switch (token) {
      case '--list': case '-l': options.list = true; break;
      case '--static': case '-s': options.static_ = true; break;
      case '--ascii': options.ascii = true; break;
      case '--mono': options.mono = true; break;
      case '--no-animations': options.noAnimations = true; break;
      case '--width': case '-w': options.width = Number(argv[++i]); break;
      case '--height': options.height = Number(argv[++i]); break;
      case '--theme': options.theme = argv[++i]; break;
      case '--shell': options.shell = argv[++i]; break;
      default:
        if (!token.startsWith('-')) options.id = token;
    }
  }
  return options;
}

function list(): void {
  process.stdout.write('TextUI playgrounds\n\n');
  const width = Math.max(...PLAYGROUNDS.map((p) => p.id.length));
  for (const playground of PLAYGROUNDS) {
    process.stdout.write(`  ${playground.id.padEnd(width)}  ${playground.description}\n`);
    process.stdout.write(`  ${' '.repeat(width)}  ${playground.exercises.join(', ')}\n`);
  }
  process.stdout.write('\nRun one: pnpm dev <id>\n');
  process.stdout.write('Options: --static --ascii --mono --no-animations --width N --theme X --shell Y\n');
}

async function main(): Promise<void> {
  const options = parse(process.argv.slice(2));

  if (options.list || !options.id) {
    list();
    return;
  }

  const playground = findPlayground(options.id);
  if (!playground) {
    process.stderr.write(`No playground called "${options.id}". Try --list.\n`);
    process.exit(1);
  }

  const capabilityOverrides = {
    ...(options.ascii ? { unicode: 'ascii' as const, wideChars: false } : {}),
    ...(options.mono ? { colorDepth: 0 as const } : {}),
  };

  // Static mode never touches the terminal, so it works in a pipe and in CI.
  // The playgrounds that reach for the application degrade to nothing here,
  // which is exactly what the static renderer promises.
  if (options.static_ || !process.stdout.isTTY) {
    process.stdout.write(
      `${renderToString(playground.node(), {
        width: options.width,
        height: options.height,
        theme: options.theme ?? playground.theme ?? 'dark',
        capabilities: capabilityOverrides,
        initialState: fixtures(),
      })}\n`,
    );
    return;
  }

  const terminal = createNodeTerminal({ capabilities: capabilityOverrides });
  const app = createApp({
    terminal,
    root: playground.node(),
    ...(options.theme ? { theme: options.theme } : {}),
    shell: options.shell ?? playground.shell ?? 'plain',
    animations: !options.noAnimations,
    session: { managed: true, altScreen: true, mouse: true, title: `TextUI - ${playground.title}` },
    onBoot: (booted) => {
      registerBuiltins(booted);
      setupPlayground(booted, playground);

      booted.commands.register({
        id: 'app.quit',
        title: 'Quit',
        slots: ['palette', 'hints'],
        run: () => {
          void app.stop().then(() => process.exit(0));
        },
      });
      booted.commands.register({
        id: 'app.palette',
        title: 'Command palette',
        slots: ['palette'],
        run: () => {
          booted.layers.open({
            id: 'palette',
            layer: 'modal',
            trapFocus: true,
            dismissOnEscape: true,
            node: {
              component: 'CommandPalette',
              width: 60,
              onClose: { handler: () => booted.layers.close('palette') },
            },
          });
        },
      });

      booted.keybindings.register({ keys: 'q', commandId: 'app.quit' });
      booted.keybindings.register({ keys: 'ctrl+c', commandId: 'app.quit' });
      booted.keybindings.register({ keys: 'ctrl+k', commandId: 'app.palette' });
    },
  });

  app.services.provide(WRITER_KEY, createWriter(terminal.capabilities()));
  await app.start();
}

await main();
