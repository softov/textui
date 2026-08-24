import { BUILTIN_THEMES, createApp, renderToString, WRITER_KEY } from '@textui/core';
import { BUILTIN_SHELLS, registerBuiltins } from '@textui/widgets';
import { createNodeTerminal, createWriter } from '@textui/terminal';
import { readFileSync } from 'node:fs';
import { TILE_PATH, tileFrom } from './tile.js';
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
  help: boolean;
  static_: boolean;
  width: number;
  height: number;
  theme?: string;
  shell?: string;
  ascii: boolean;
  mono: boolean;
  noAnimations: boolean;
  /** A text file to tile with, for the pattern playground. */
  tile?: string;
}

function parse(argv: string[]): Options {
  const options: Options = {
    id: null,
    list: false,
    help: false,
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
      case '--help': case '-h': options.help = true; break;
      case '--list': case '-l': options.list = true; break;
      case '--static': case '-s': options.static_ = true; break;
      case '--ascii': options.ascii = true; break;
      case '--mono': options.mono = true; break;
      case '--no-animations': options.noAnimations = true; break;
      case '--width': case '-w': options.width = Number(argv[++i]); break;
      case '--height': options.height = Number(argv[++i]); break;
      case '--theme': options.theme = argv[++i]; break;
      case '--shell': options.shell = argv[++i]; break;
      case '--tile': options.tile = argv[++i]; break;
      default:
        if (!token.startsWith('-')) options.id = token;
    }
  }
  return options;
}

/**
 * The tile named on the command line, if there was one.
 *
 * Read here rather than in the playground so a tile can be tried without
 * touching any code, and so nothing under `src/` has to import `node:fs`.
 * A file that cannot be read is worth saying so about and carrying on with
 * the built-in tile - it is a playground, not a build.
 */
function seedTile(options: Options): Record<string, unknown> {
  if (options.tile === undefined) return {};
  try {
    const tile = tileFrom(readFileSync(options.tile, 'utf8'), options.tile);
    if (tile === null) {
      process.stderr.write(`Tile file "${options.tile}" is empty. Using the built-in tile.\n`);
      return {};
    }
    return { [TILE_PATH]: tile };
  } catch (error) {
    process.stderr.write(`Cannot read tile "${options.tile}": ${String(error)}\n`);
    return {};
  }
}

/** Two columns, the left one padded to the widest key. */
function table(rows: [string, string][], indent = '  '): string {
  const width = Math.max(...rows.map(([key]) => key.length));
  return rows.map(([key, note]) => `${indent}${key.padEnd(width)}  ${note}\n`).join('');
}

function list(): void {
  process.stdout.write('TextUI playgrounds\n\n');
  const width = Math.max(...PLAYGROUNDS.map((p) => p.id.length));
  for (const playground of PLAYGROUNDS) {
    process.stdout.write(`  ${playground.id.padEnd(width)}  ${playground.description}\n`);
    process.stdout.write(`  ${' '.repeat(width)}  ${playground.exercises.join(', ')}\n`);
  }
  process.stdout.write('\nRun one: pnpm dev <id>.  Every option: pnpm dev --help\n');
}

/**
 * Themes and shells are listed by name rather than described in prose,
 * because the reason to reach for `--help` here is to find out what may
 * follow `--theme` without going to read the registry.
 */
function help(): void {
  process.stdout.write('TextUI playgrounds\n\n');
  process.stdout.write('  pnpm dev <id> [options]\n\n');

  process.stdout.write('Options\n');
  process.stdout.write(table([
    ['-l, --list', 'List the playgrounds and what each one exercises.'],
    ['-h, --help', 'This.'],
    ['-s, --static', 'Render one frame to stdout and exit. Implied off a TTY.'],
    ['-w, --width N', 'Columns to render at. Defaults to the terminal\'s.'],
    ['    --height N', 'Rows to render at.'],
    ['    --theme X', 'One of the themes below.'],
    ['    --shell Y', 'One of the shells below.'],
    ['    --tile FILE', 'Tile the pattern playground with this text file.'],
    ['    --ascii', 'Pretend the terminal cannot draw Unicode.'],
    ['    --mono', 'Pretend the terminal has no colour.'],
    ['    --no-animations', 'Hold every animation on its first frame.'],
  ]));

  process.stdout.write('\nThemes\n');
  process.stdout.write(table(
    BUILTIN_THEMES.map((t) => [t.id, `${t.name} - ${t.appearance}, ${t.border ?? 'single'} borders`]),
  ));

  process.stdout.write('\nShells\n');
  process.stdout.write(table(
    BUILTIN_SHELLS.map((s) => [s.id, s.description ?? s.title]),
  ));

  process.stdout.write('\nA playground may pick its own theme and shell; the flags override it.\n');
  process.stdout.write('Compare two: pnpm dev overlays --static --theme light --width 80\n');
}

async function main(): Promise<void> {
  const options = parse(process.argv.slice(2));

  if (options.help) {
    help();
    return;
  }

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
        initialState: { ...fixtures(), ...seedTile(options) },
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
      for (const [path, value] of Object.entries(seedTile(options))) {
        booted.store.set(path as never, value);
      }

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
