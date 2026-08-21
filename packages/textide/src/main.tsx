import { createApp, WRITER_KEY, renderToString } from '@textui/core';
import { createNodeTerminal, createWriter } from '@textui/terminal';
import { loadWorkspace } from './workspace.js';
import { registerTextide } from './register.js';
import { Editor, Explorer } from './app.js';
import { TitleBar } from './chrome/titlebar.js';
import { StatusLine } from './chrome/statusbar.js';

/**
 * The entry point.
 *
 * `textide [dir]` opens a workspace. `--static` renders one frame to stdout,
 * which is what makes it usable in a pipe and checkable in CI, and the reason
 * a screenshot of it can be taken without a terminal.
 */

interface Options {
  dir: string;
  static_: boolean;
  width: number;
  height: number;
  theme?: string;
  readonly: boolean;
  hidden: boolean;
}

function parse(argv: string[]): Options {
  const options: Options = {
    dir: process.cwd(),
    static_: false,
    width: process.stdout.columns ?? 100,
    height: process.stdout.rows ?? 30,
    readonly: false,
    hidden: false,
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

const HELP = `textide - an IDE in a terminal

  textide [dir]           open a workspace (default: the current directory)

  --readonly, -r          refuse every write
  --hidden                list dotfiles
  --theme <id>            override the workspace theme
  --static, -s            render one frame to stdout and exit
  --width N --height N    size for --static
`;

async function main(): Promise<void> {
  const options = parse(process.argv.slice(2));
  const workspace = await loadWorkspace(options.dir);
  if (options.readonly) workspace.readonly = true;
  if (options.hidden) workspace.hidden = true;
  const theme = options.theme ?? workspace.theme ?? 'paper-dark';

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

  const terminal = createNodeTerminal();
  const app = createApp({
    terminal,
    // No `root`: everything textide shows is a surface mount. Passing one puts
    // a second, empty tab beside the editor in `main`, which is a tab strip
    // nobody asked for and two extra stops in the tab order.
    theme,
    shell: 'workbench',
    session: { managed: true, altScreen: true, mouse: true, title: `textide - ${workspace.name}` },
    onBoot: (booted) => {
      registerTextide(booted, { workspace });

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

  app.services.provide(WRITER_KEY, createWriter(terminal.capabilities()));
  await app.start();
}

await main();
