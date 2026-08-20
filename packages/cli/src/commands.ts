import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { detectCapabilities, describeEnvironment } from '@textui/terminal';
import { BUILTIN_THEMES, CATALOG, renderToString } from '@textui/core';
import type { CliCommand } from './app.js';
import { CliError, promptConfirm } from './app.js';
import {
  DEFAULT_CONFIG, copyComponent, diffInstalled, findProjectRoot, loadRegistry,
  readConfig, readReceipt, resolveDependencies, writeConfig, writeReceipt,
  type ProjectConfig,
} from './registry.js';

/**
 * The developer CLI.
 *
 * Every command that writes to a project says what it is going to write before
 * it writes it, and refuses to overwrite a file the user has edited. That
 * refusal is the whole reason the receipt file exists.
 */

async function requireProject(): Promise<{ root: string; config: ProjectConfig }> {
  const root = await findProjectRoot();
  if (!root) {
    throw new CliError('no textui.config.json found. Run `textui init` first.');
  }
  return { root, config: await readConfig(root) };
}

export const initCommand: CliCommand = {
  name: 'init',
  description: 'Set up TextUI in this project',
  options: [
    { name: 'components', type: 'string', description: 'Where components are copied', default: DEFAULT_CONFIG.componentsDir },
    { name: 'templates', type: 'string', description: 'Where screens are copied', default: DEFAULT_CONFIG.templatesDir },
    { name: 'theme', type: 'string', description: 'Default theme', default: 'dark', choices: BUILTIN_THEMES.map((t) => t.id) },
    { name: 'shell', type: 'string', description: 'Default shell', default: 'plain', choices: ['plain', 'console', 'paper', 'workbench'] },
    { name: 'yes', short: 'y', type: 'boolean', description: 'Accept the defaults' },
  ],
  examples: ['textui init', 'textui init --shell workbench --theme workbench'],
  async run(args, cli) {
    const root = process.cwd();
    const existing = await findProjectRoot(root);
    if (existing === root) {
      throw new CliError('this project is already initialised');
    }

    const config: ProjectConfig = {
      ...DEFAULT_CONFIG,
      componentsDir: String(args.options.components),
      templatesDir: String(args.options.templates),
      theme: String(args.options.theme),
      shell: String(args.options.shell),
    };

    cli.write('This will create:\n');
    cli.write(`  textui.config.json\n`);
    cli.write(`  ${config.componentsDir}/\n`);
    cli.write(`  ${config.templatesDir}/\n\n`);

    if (!args.options.yes && !(await promptConfirm('Continue?', { default: true }))) {
      cli.write('Nothing was written.\n');
      return 1;
    }

    const path = await writeConfig(root, config);
    await mkdir(join(root, config.componentsDir), { recursive: true });
    await mkdir(join(root, config.templatesDir), { recursive: true });

    cli.write(`\nWrote ${path}\n`);
    cli.write('\nNext:\n');
    cli.write('  textui list          see what is available\n');
    cli.write('  textui add table     copy a component into your project\n');
    cli.write('  textui create dashboard\n');
    return 0;
  },
};

export const listCommand: CliCommand = {
  name: 'list',
  aliases: ['ls'],
  description: 'List registry components, templates and themes',
  options: [
    { name: 'category', type: 'string', description: 'Filter by category' },
    { name: 'catalog', type: 'boolean', description: 'List the built-in component catalog instead' },
    { name: 'json', type: 'boolean', description: 'Machine-readable output' },
  ],
  async run(args, cli) {
    if (args.options.catalog) {
      const category = args.options.category as string | undefined;
      const items = CATALOG
        .filter((c) => !category || c.category === category)
        .map((c) => ({ name: c.component, category: c.category ?? '-', description: c.description ?? '' }));

      if (args.options.json) {
        cli.write(`${JSON.stringify(items, null, 2)}\n`);
        return 0;
      }
      cli.write(table(
        ['COMPONENT', 'CATEGORY', 'DESCRIPTION'],
        items.map((i) => [i.name, i.category, i.description]),
      ));
      return 0;
    }

    const { manifest } = await loadRegistry();

    if (args.options.json) {
      cli.write(`${JSON.stringify(manifest, null, 2)}\n`);
      return 0;
    }

    cli.write(`${manifest.name} ${manifest.version}\n\n`);
    cli.write('Components:\n');
    cli.write(table(
      ['NAME', 'CATEGORY', 'DEPENDS ON', 'DESCRIPTION'],
      manifest.components.map((c) => [
        c.name, c.category ?? '-', (c.dependencies ?? []).join(', ') || '-', c.description ?? '',
      ]),
    ));

    cli.write('\nTemplates:\n');
    cli.write(table(
      ['NAME', 'DESCRIPTION'],
      (manifest.templates ?? []).map((t) => [t.name, t.description ?? '']),
    ));

    cli.write('\nThemes:\n');
    cli.write(table(
      ['NAME', 'APPEARANCE'],
      (manifest.themes ?? []).map((t) => [t.name, t.appearance]),
    ));
    return 0;
  },
};

export const addCommand: CliCommand = {
  name: 'add',
  description: 'Copy components into your project',
  arguments: [{ name: 'components', required: true, variadic: true, description: 'Component names' }],
  options: [
    { name: 'force', short: 'f', type: 'boolean', description: 'Overwrite files you have edited' },
    { name: 'dry-run', type: 'boolean', description: 'Show what would happen' },
    { name: 'registry', type: 'string', description: 'Registry path or name' },
    { name: 'yes', short: 'y', type: 'boolean', description: 'Do not ask' },
  ],
  examples: ['textui add service-table', 'textui add status-dot metric-card --dry-run'],
  async run(args, cli) {
    const { root, config } = await requireProject();
    const registrySource = resolveRegistrySource(config, args.options.registry as string | undefined);
    const { manifest, dir } = await loadRegistry(registrySource);

    const requested = args.positionals;
    const components = resolveDependencies(manifest, requested);
    const receipt = await readReceipt(root);

    const implied = components.filter((c) => !requested.includes(c.name));
    if (implied.length > 0) {
      cli.write(`Also adding, as dependencies: ${implied.map((c) => c.name).join(', ')}\n`);
    }

    cli.write('\nWill write:\n');
    for (const component of components) {
      for (const file of component.files) {
        const target = file.target ?? join(config.componentsDir, file.path.split('/').pop() as string);
        cli.write(`  ${target}${existsSync(join(root, target)) ? '  (exists)' : ''}\n`);
      }
    }
    cli.write('\n');

    if (!args.options['dry-run'] && !args.options.yes) {
      if (!(await promptConfirm('Continue?', { default: true }))) {
        cli.write('Nothing was written.\n');
        return 1;
      }
    }

    let refused = 0;
    for (const component of components) {
      const result = await copyComponent(component, {
        root,
        registryDir: dir,
        registryName: manifest.name,
        config,
        receipt,
        force: Boolean(args.options.force),
        dryRun: Boolean(args.options['dry-run']),
      });

      for (const path of result.written) cli.write(`  + ${path}\n`);
      for (const skip of result.skipped) {
        refused++;
        cli.write(
          skip.reason === 'modified'
            ? `  ! ${skip.path} - you have edited this; left alone (use --force to replace)\n`
            : `  = ${skip.path} - already present; left alone\n`,
        );
      }
    }

    if (!args.options['dry-run']) await writeReceipt(root, receipt);
    if (args.options['dry-run']) cli.write('\nDry run: nothing was written.\n');

    return refused > 0 ? 1 : 0;
  },
};

export const createCommand: CliCommand = {
  name: 'create',
  description: 'Scaffold a template into your project',
  arguments: [{ name: 'template', required: true, description: 'Template name' }],
  options: [
    { name: 'name', type: 'string', description: 'File name to write' },
    { name: 'yes', short: 'y', type: 'boolean', description: 'Do not ask' },
  ],
  examples: ['textui create dashboard', 'textui create logs --name log-screen'],
  async run(args, cli) {
    const { root, config } = await requireProject();
    const { manifest, dir } = await loadRegistry();

    const name = args.positionals[0] as string;
    const template = (manifest.templates ?? []).find((t) => t.name === name);
    if (!template) {
      const known = (manifest.templates ?? []).map((t) => t.name).join(', ');
      throw new CliError(`unknown template "${name}". Available: ${known}`);
    }

    // A template is composed from public components, so pull in what it needs.
    if (template.components.length > 0) {
      const components = resolveDependencies(manifest, template.components);
      const receipt = await readReceipt(root);
      for (const component of components) {
        const result = await copyComponent(component, {
          root, registryDir: dir, registryName: manifest.name, config, receipt,
        });
        for (const path of result.written) cli.write(`  + ${path}\n`);
      }
      await writeReceipt(root, receipt);
    }

    for (const file of template.files) {
      const source = join(dir, file);
      if (!existsSync(source)) {
        cli.write(`  ! ${file} is listed in the registry but missing from it\n`);
        continue;
      }
      const base = (args.options.name as string | undefined) ?? (file.split('/').pop() as string).replace(/\.tsx?$/, '');
      const target = join(root, config.templatesDir, `${base}.tsx`);

      if (existsSync(target) && !args.options.yes) {
        if (!(await promptConfirm(`${config.templatesDir}/${base}.tsx exists. Overwrite?`, { default: false }))) {
          cli.write(`  = skipped ${base}.tsx\n`);
          continue;
        }
      }

      const content = (await readFile(source, 'utf8'))
        .replace(/from '@textui\/core'/g, `from '${config.alias}'`);
      await mkdir(join(root, config.templatesDir), { recursive: true });
      await writeFile(target, content, 'utf8');
      cli.write(`  + ${config.templatesDir}/${base}.tsx\n`);
    }

    cli.write(`\nCreated "${name}".\n`);
    return 0;
  },
};

export const themeCommand: CliCommand = {
  name: 'theme',
  description: 'List themes, or preview one',
  arguments: [{ name: 'theme', description: 'Theme to preview' }],
  options: [
    { name: 'set', type: 'string', description: 'Set the project default' },
    { name: 'width', short: 'w', type: 'number', description: 'Preview width', default: 60 },
  ],
  examples: ['textui theme', 'textui theme workbench', 'textui theme --set paper'],
  async run(args, cli) {
    if (args.options.set) {
      const { root, config } = await requireProject();
      const id = String(args.options.set);
      if (!BUILTIN_THEMES.some((t) => t.id === id)) {
        throw new CliError(`unknown theme "${id}"`);
      }
      await writeConfig(root, { ...config, theme: id });
      cli.write(`Default theme is now "${id}".\n`);
      return 0;
    }

    const name = args.positionals[0];
    if (!name) {
      cli.write(table(
        ['THEME', 'APPEARANCE', 'BORDER', 'DENSITY'],
        BUILTIN_THEMES.map((t) => [t.id, t.appearance, t.border ?? '-', t.density ?? 'normal']),
      ));
      cli.write('\nPreview one with `textui theme <name>`.\n');
      return 0;
    }

    if (!BUILTIN_THEMES.some((t) => t.id === name)) {
      throw new CliError(`unknown theme "${name}"`);
    }

    cli.write(`${renderToString(themePreview(), {
      theme: name,
      width: Number(args.options.width),
    })}\n`);
    return 0;
  },
};

function themePreview() {
  return {
    component: 'box',
    direction: 'column',
    gap: 1,
    padding: 1,
    children: [
      { component: 'Heading', content: 'Theme preview' },
      {
        component: 'box',
        direction: 'row',
        gap: 2,
        children: [
          { component: 'StatusDot', status: 'up', label: 'up' },
          { component: 'StatusDot', status: 'degraded', label: 'degraded' },
          { component: 'StatusDot', status: 'down', label: 'down' },
        ],
      },
      { component: 'Progress', value: 0.62, label: 'progress', barWidth: 24 },
      { component: 'Sparkline', values: [1, 4, 2, 8, 5, 9, 3, 7], chartWidth: 24 },
      {
        component: 'Panel',
        title: 'Panel',
        children: { component: 'text', content: 'Body text inside a panel.' },
      },
      {
        component: 'box',
        direction: 'row',
        gap: 1,
        children: [
          { component: 'Badge', label: 'default' },
          { component: 'Badge', label: 'success', tone: 'success' },
          { component: 'Badge', label: 'danger', tone: 'danger' },
        ],
      },
    ],
  };
}

export const registryCommand: CliCommand = {
  name: 'registry',
  description: 'Manage component registries',
  commands: [
    {
      name: 'add',
      description: 'Register another registry by name',
      arguments: [
        { name: 'name', required: true },
        { name: 'source', required: true, description: 'Path to a directory containing registry.json' },
      ],
      async run(args, cli) {
        const { root, config } = await requireProject();
        const [name, source] = args.positionals as [string, string];
        await loadRegistry(source);
        await writeConfig(root, {
          ...config,
          registries: { ...config.registries, [name]: source },
        });
        cli.write(`Registry "${name}" added.\n`);
        return 0;
      },
    },
    {
      name: 'list',
      description: 'Show registered registries',
      async run(_args, cli) {
        const { config } = await requireProject();
        const entries = Object.entries(config.registries ?? {});
        cli.write(table(
          ['NAME', 'SOURCE'],
          [['textui', '(built in)'], ...entries],
        ));
        return 0;
      },
    },
  ],
};

export const diffCommand: CliCommand = {
  name: 'diff',
  description: 'Show which copied components have drifted from upstream',
  async run(_args, cli) {
    const { root, config } = await requireProject();
    const { manifest, dir } = await loadRegistry();
    const receipt = await readReceipt(root);
    const report = await diffInstalled(root, dir, manifest, receipt, config);

    if (report.length === 0) {
      cli.write('Nothing installed from the registry yet.\n');
      return 0;
    }

    const symbols = { unchanged: '=', modified: 'M', outdated: 'U', missing: '!' } as const;
    cli.write(table(
      ['', 'COMPONENT', 'FILE', 'STATE'],
      report.map((r) => [symbols[r.state], r.component, r.file, r.state]),
    ));
    cli.write('\nM = you edited it   U = upstream changed   ! = file is gone\n');
    return report.some((r) => r.state === 'missing') ? 1 : 0;
  },
};

export const doctorCommand: CliCommand = {
  name: 'doctor',
  description: 'Report what this terminal can do, and what the project looks like',
  options: [{ name: 'json', type: 'boolean', description: 'Machine-readable output' }],
  async run(args, cli) {
    const env = describeEnvironment({
      env: process.env,
      isTTY: Boolean(process.stdout.isTTY),
      columns: process.stdout.columns,
      rows: process.stdout.rows,
    });
    const caps = detectCapabilities({
      env: process.env,
      isTTY: Boolean(process.stdout.isTTY),
      columns: process.stdout.columns,
      rows: process.stdout.rows,
    });

    const root = await findProjectRoot();
    const project = root ? await readConfig(root) : null;

    if (args.options.json) {
      cli.write(`${JSON.stringify({ env, capabilities: caps, project, root }, null, 2)}\n`);
      return 0;
    }

    cli.write('Environment\n');
    cli.write(table(['KEY', 'VALUE'], Object.entries(env)));

    cli.write('\nCapabilities\n');
    cli.write(table(
      ['CAPABILITY', 'VALUE'],
      Object.entries(caps).map(([k, v]) => [k, String(v)]),
    ));

    cli.write('\nProject\n');
    if (!project) {
      cli.write('  no textui.config.json found - run `textui init`\n');
    } else {
      cli.write(table(['KEY', 'VALUE'], [
        ['root', root as string],
        ['components', project.componentsDir],
        ['templates', project.templatesDir],
        ['theme', project.theme ?? 'dark'],
        ['shell', project.shell ?? 'plain'],
      ]));
    }

    const warnings: string[] = [];
    if (caps.colorDepth === 0) warnings.push('No colour: output will rely on glyphs alone (this is supported).');
    if (caps.unicode === 'ascii') warnings.push('No Unicode: borders and glyphs degrade to ASCII.');
    if (!process.stdout.isTTY) warnings.push('Not a terminal: interactive apps will not start, static rendering still works.');

    if (warnings.length > 0) {
      cli.write('\nNotes\n');
      for (const warning of warnings) cli.write(`  - ${warning}\n`);
    }
    return 0;
  },
};

function resolveRegistrySource(config: ProjectConfig, requested?: string): string | undefined {
  if (!requested) return undefined;
  return config.registries?.[requested] ?? requested;
}

/** A plain aligned table. The CLI's own output has no dependency on the TUI. */
function table(headers: string[], rows: string[][]): string {
  const all = [headers, ...rows];
  const widths = headers.map((_, i) => Math.max(...all.map((r) => (r[i] ?? '').length)));
  const line = (cells: string[]): string =>
    `  ${cells.map((c, i) => (c ?? '').padEnd(widths[i] as number)).join('  ')}`.trimEnd();

  return [line(headers), ...rows.map(line)].join('\n') + '\n';
}

export const COMMANDS: CliCommand[] = [
  initCommand,
  addCommand,
  createCommand,
  listCommand,
  themeCommand,
  registryCommand,
  diffCommand,
  doctorCommand,
];
