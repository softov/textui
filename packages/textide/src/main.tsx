import { readFile } from 'node:fs/promises';
import type { CapabilityOverrides, ColorDepth, Disposable, TextUIApp, UnicodeLevel } from '@textui/core';
import { createApp, WRITER_KEY, renderToString } from '@textui/core';
import { createNodeTerminal, createWriter } from '@textui/terminal';
import { loadWorkspace } from './workspace.js';
import { registerTextide, type RegisterOptions } from './register.js';
import { createReloader } from './reload.js';
import { loadExtensions, resolveSpecifier, type ExtensionModule } from './extensions.js';
import { attachLog, fileSink, unixSink } from './log.js';
import { Editor, Explorer } from './app.js';
import { TitleBar } from './chrome/titlebar.js';
import { StatusLine } from './chrome/statusbar.js';

/**
 * The entry point.
 *
 * `textide [dir]` opens a workspace. `--static` renders one frame to stdout,
 * which is what makes it usable in a pipe and checkable in CI, and the reason
 * a screenshot of it can be taken without a terminal. Once it is running, f12
 * writes the frame that is actually on screen - state, scroll position and
 * all - which is the one `--static` cannot give you.
 */

interface Options {
  dir: string;
  static_: boolean;
  width: number;
  height: number;
  theme?: string;
  readonly: boolean;
  hidden: boolean;
  logFile?: string;
  logUnix?: string;
  verbose: boolean;
  unicode?: UnicodeLevel;
  colors?: ColorDepth;
  shots?: string;
}

const UNICODE_LEVELS: UnicodeLevel[] = ['ascii', 'bmp', 'full'];
const COLOR_DEPTHS: ColorDepth[] = [0, 4, 8, 24];

function parse(argv: string[]): Options {
  const options: Options = {
    dir: process.cwd(),
    static_: false,
    width: process.stdout.columns ?? 100,
    height: process.stdout.rows ?? 30,
    readonly: false,
    hidden: false,
    verbose: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i] as string;
    switch (token) {
      case '--static': case '-s': options.static_ = true; break;
      case '--readonly': case '-r': options.readonly = true; break;
      case '--hidden': options.hidden = true; break;
      case '--width': case '-w': options.width = Number(argv[++i]); break;
      case '--height': options.height = Number(argv[++i]); break;
      case '--theme': options.theme = argv[++i]; break;
      case '--unicode': {
        const level = argv[++i] as UnicodeLevel;
        if (!UNICODE_LEVELS.includes(level)) fail(`--unicode must be one of ${UNICODE_LEVELS.join(', ')}`);
        options.unicode = level;
        break;
      }
      case '--colors': case '--colours': {
        const depth = Number(argv[++i]) as ColorDepth;
        if (!COLOR_DEPTHS.includes(depth)) fail(`--colors must be one of ${COLOR_DEPTHS.join(', ')}`);
        options.colors = depth;
        break;
      }
      case '--shots': options.shots = argv[++i]; break;
      case '--log-file': options.logFile = argv[++i]; break;
      case '--log-unix': options.logUnix = argv[++i]; break;
      case '--verbose': options.verbose = true; break;
      case '--help': case '-h':
        process.stdout.write(HELP);
        process.exit(0);
        break;
      default:
        if (!token.startsWith('-')) options.dir = token;
    }
  }
  return options;
}

function fail(message: string): never {
  process.stderr.write(`textide: ${message}\n`);
  process.exit(2);
}

/**
 * What to tell the runtime about the terminal, when the answer is not the
 * truth.
 *
 * Detection is right almost always, and the times it is not are exactly the
 * times you need to see the other answer: what this looks like on a console
 * that has no dingbats, or with sixteen colours, without owning one.
 */
function overrides(options: Options): CapabilityOverrides | undefined {
  const out: CapabilityOverrides = {};
  if (options.unicode !== undefined) {
    out.unicode = options.unicode;
    // A terminal that cannot draw a dingbat cannot draw a double-width one
    // either, and the layout depends on that being true.
    out.wideChars = options.unicode !== 'ascii';
  }
  if (options.colors !== undefined) out.colorDepth = options.colors;
  return Object.keys(out).length > 0 ? out : undefined;
}

const HELP = `textide - an IDE in a terminal

  textide [dir]           open a workspace (default: the current directory)

  --readonly, -r          refuse every write
  --hidden                list dotfiles
  --theme <id>            override the workspace theme
  --static, -s            render one frame to stdout and exit
  --width N --height N    size for --static

  --unicode <level>       draw as ascii, bmp or full, whatever the terminal is
  --colors <0|4|8|24>     draw at this colour depth
  --shots <dir>           where f12 writes a screenshot (default: here)

  --log-file <path>       append a JSONL log of what the runtime does
  --log-unix <path>       send that log to whatever is listening on a socket
  --verbose               log every store write, not only focus and chrome

A terminal application cannot print its own diagnostics - the screen is the
output - so the log leaves the process. examples/logtail.mjs listens.
`;

async function main(): Promise<void> {
  const options = parse(process.argv.slice(2));
  const workspace = await loadWorkspace(options.dir);
  if (options.readonly) workspace.readonly = true;
  if (options.hidden) workspace.hidden = true;
  const theme = options.theme ?? workspace.theme ?? 'paper-dark';
  const capabilities = overrides(options);

  // Static mode has no application, so the parts of the screen that ask the
  // registry what opens a file render empty. The chrome is what it is for:
  // a frame that can be captured in a pipe, a CI check, or a screenshot.
  if (options.static_ || !process.stdout.isTTY) {
    process.stdout.write(`${renderToString({
      component: 'box',
      direction: 'column',
      flex: 1,
      children: [
        { component: 'TitleBar' },
        { component: 'box', direction: 'row', flex: 1, children: [
          { component: 'Explorer', width: 30 },
          { component: 'Editor', flex: 1 },
        ] },
        { component: 'StatusLine' },
      ],
    }, {
      width: options.width,
      height: options.height,
      theme,
      ...(capabilities ? { capabilities } : {}),
      components: [
        { component: 'TitleBar', category: 'chrome', renderer: { kind: 'function', render: TitleBar } },
        { component: 'StatusLine', category: 'chrome', renderer: { kind: 'function', render: StatusLine } },
        { component: 'Explorer', category: 'chrome', renderer: { kind: 'function', render: Explorer } },
        { component: 'Editor', category: 'chrome', renderer: { kind: 'function', render: Editor } },
      ],
      initialState: {
        '$/app/workspace': workspace,
        '$/ui/sidebar/collapsed': workspace.sidebarCollapsed === true,
      },
    })}\n`);
    return;
  }

  const terminal = createNodeTerminal(capabilities ? { capabilities } : {});
  const registration = { workspace, ...(options.shots ? { shots: options.shots } : {}) };
  // The bag textide's registration returns. A hot reload disposes exactly this
  // and nothing else, which is the whole of what "ownership" means here - so
  // the entry point has to keep it rather than dropping it on the floor.
  let bag: Disposable | null = null;

  const app = createApp({
    terminal,
    // No `root`: everything textide shows is a surface mount. Passing one puts
    // a second, empty tab beside the editor in `main`, which is a tab strip
    // nobody asked for and two extra stops in the tab order.
    theme,
    shell: 'workbench',
    session: { managed: true, altScreen: true, mouse: true, title: `textide - ${workspace.name}` },
    onBoot: (booted) => {
      bag = registerTextide(booted, registration);

      booted.commands.register({
        id: 'app.quit',
        title: 'Quit',
        slots: ['palette', 'hints'],
        run: () => {
          void app.stop().then(() => process.exit(0));
        },
      });
      // Only the keys that belong to running as a program. The editor's own
      // are registered by `registerTextide`, so an embedded textide keeps them.
      booted.keybindings.register({ keys: 'q', commandId: 'app.quit' });
      booted.keybindings.register({ keys: 'ctrl+c', commandId: 'app.quit' });
    },
  });

  const sink = options.logUnix
    ? unixSink(options.logUnix)
    : options.logFile ? fileSink(options.logFile) : null;
  if (sink) attachLog(app, sink, { verbose: options.verbose });

  app.services.provide(WRITER_KEY, createWriter(terminal.capabilities()));
  await app.start();

  // After the first frame, and in its own bag: an extension that is slow to
  // load should not hold up the screen, and a reload of textide's own screen
  // has no business unloading somebody's git panel.
  await loadExtensions(app, workspace, {
    load: (specifier) => bundledFirst(specifier, workspace.root),
  });

  if (process.env.TEXTIDE_RELOAD && bag) await attachReload(app, bag, registration);
}

/**
 * An extension that was bundled into this process, in preference to the
 * package of the same name.
 *
 * The dev runner bundles the runtime once and has everything import that one
 * copy, because two copies of `@textui/core` means components whose hooks read
 * a `currentInstance` this renderer never sets. An extension loaded by
 * specifier would walk straight past that and pull in its own - so the runner
 * writes down what it bundled, and this reads the note.
 *
 * There is no note beside the published `dist`, which is the correct answer
 * there: nothing was bundled, and the package resolves normally.
 */
async function bundledFirst(specifier: string, root: string): Promise<ExtensionModule> {
  const note = new URL('./bundled.json', import.meta.url);
  try {
    const map = JSON.parse(await readFile(note, 'utf8')) as Record<string, string>;
    const file = map[specifier];
    if (file) return await (import(new URL(file, import.meta.url).href) as Promise<ExtensionModule>);
  } catch {
    // No note, or an unreadable one. Resolve the specifier as anyone would.
  }
  return import(resolveSpecifier(specifier, root)) as Promise<ExtensionModule>;
}

/**
 * Hot reload, when the dev runner asked for it.
 *
 * The runner rebuilds and sends SIGUSR2; this re-imports the screen module at
 * a URL nothing has imported before, because ESM has no way to invalidate one.
 * `screen.mjs` sits beside this file and imports the same runtime files this
 * process is already holding - see `scripts/dev.mjs` for why that matters.
 *
 * Nothing here touches the store, so every open buffer, every unsaved edit and
 * the file you were looking at all come through the swap untouched.
 */
async function attachReload(
  app: TextUIApp,
  initial: Disposable,
  registration: RegisterOptions,
): Promise<void> {
  const reloader = createReloader(app, {
    initial,
    load: async (generation: number) => {
      const href = `${new URL('./screen.mjs', import.meta.url).href}?v=${generation}`;
      const next = (await import(href)) as { registerTextide: typeof registerTextide };
      return (target: TextUIApp) => next.registerTextide(target, registration);
    },
  });

  const run = (): void => { void reloader.reload().then(() => app.flush()); };

  app.commands.register({
    id: 'app.reload',
    title: 'Reload',
    category: 'View',
    slots: ['palette'],
    description: 'Re-register the editor from the sources on disk',
    run,
  });
  app.keybindings.register({ keys: 'f5', commandId: 'app.reload' });
  process.on('SIGUSR2', run);
}

await main();
