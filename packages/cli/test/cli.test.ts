import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs, CliError, type Cli } from '../src/app.js';
import { createCli } from '../src/cli.js';
import {
  hashContent, loadRegistry, resolveDependencies, readReceipt,
} from '../src/registry.js';

describe('argument parsing', () => {
  const specs = [
    { name: 'width', short: 'w', type: 'number' as const },
    { name: 'force', short: 'f', type: 'boolean' as const },
    { name: 'name', type: 'string' as const },
    { name: 'tag', type: 'string' as const, multiple: true },
    { name: 'theme', type: 'string' as const, choices: ['dark', 'light'] },
  ];

  it('parses long options with a following value', () => {
    expect(parseArgs(['--width', '80'], specs).options.width).toBe(80);
  });

  it('parses long options with an equals sign', () => {
    expect(parseArgs(['--width=80'], specs).options.width).toBe(80);
  });

  it('parses boolean flags and their negation', () => {
    expect(parseArgs(['--force'], specs).options.force).toBe(true);
    expect(parseArgs(['--no-force'], specs).options.force).toBe(false);
    expect(parseArgs([], specs).options.force).toBe(false);
  });

  it('parses short flags, including bundled ones', () => {
    expect(parseArgs(['-f'], specs).options.force).toBe(true);
    expect(parseArgs(['-w', '40'], specs).options.width).toBe(40);
    expect(parseArgs(['-w40'], specs).options.width).toBe(40);
  });

  it('collects repeatable options', () => {
    expect(parseArgs(['--tag', 'a', '--tag', 'b'], specs).options.tag).toEqual(['a', 'b']);
  });

  it('keeps positionals in order', () => {
    const parsed = parseArgs(['one', '--force', 'two'], specs);
    expect(parsed.positionals).toEqual(['one', 'two']);
  });

  it('stops parsing after a bare --', () => {
    const parsed = parseArgs(['--force', '--', '--not-an-option'], specs);
    expect(parsed.rest).toEqual(['--not-an-option']);
  });

  it('rejects an unknown option rather than treating it as a filename', () => {
    expect(() => parseArgs(['--wdith', '80'], specs)).toThrow(/unknown option --wdith/);
  });

  it('rejects a value outside the allowed choices', () => {
    expect(() => parseArgs(['--theme', 'neon'], specs)).toThrow(/must be one of/);
  });

  it('rejects a non-numeric value for a number option', () => {
    expect(() => parseArgs(['--width', 'wide'], specs)).toThrow(/must be a number/);
  });

  it('rejects an option with no value', () => {
    expect(() => parseArgs(['--name'], specs)).toThrow(/needs a value/);
  });
});

describe('help', () => {
  function capture(): { cli: Cli; out(): string } {
    let text = '';
    const cli = createCli({ write: (t) => { text += t; }, writeError: (t) => { text += t; } });
    return { cli, out: () => text };
  }

  it('prints the command list with no arguments', async () => {
    const { cli, out } = capture();
    expect(await cli.run([])).toBe(0);
    expect(out()).toContain('Usage: textui <command>');
    expect(out()).toContain('init');
    expect(out()).toContain('doctor');
  });

  it('prints command help for --help', async () => {
    const { cli, out } = capture();
    expect(await cli.run(['add', '--help'])).toBe(0);
    expect(out()).toContain('Usage: textui add <components...>');
    expect(out()).toContain('--force');
  });

  it('prints the version', async () => {
    const { cli, out } = capture();
    expect(await cli.run(['--version'])).toBe(0);
    expect(out().trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('reports an unknown option as an error, not a crash', async () => {
    const { cli, out } = capture();
    expect(await cli.run(['list', '--nope'])).toBe(1);
    expect(out()).toContain('unknown option --nope');
  });

  it('reports a missing required argument', async () => {
    const { cli, out } = capture();
    expect(await cli.run(['add'])).toBe(1);
    expect(out()).toContain('missing argument: components');
  });
});

describe('the registry', () => {
  it('loads the shipped manifest', async () => {
    const { manifest } = await loadRegistry();
    expect(manifest.name).toBe('textui');
    expect(manifest.components.length).toBeGreaterThan(0);
  });

  it('resolves dependencies before dependants', async () => {
    const { manifest } = await loadRegistry();
    const order = resolveDependencies(manifest, ['service-table']).map((c) => c.name);
    expect(order).toEqual(['status-dot', 'service-table']);
  });

  it('does not install a component twice', async () => {
    const { manifest } = await loadRegistry();
    const order = resolveDependencies(manifest, ['status-dot', 'service-table']).map((c) => c.name);
    expect(order).toEqual(['status-dot', 'service-table']);
  });

  it('names the alternatives when a component is unknown', async () => {
    const { manifest } = await loadRegistry();
    expect(() => resolveDependencies(manifest, ['not-real'])).toThrow(/Available:/);
  });
});

describe('a project', () => {
  let dir = '';
  let cwd = '';

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'textui-cli-'));
    cwd = process.cwd();
    process.chdir(dir);
  });

  afterEach(async () => {
    process.chdir(cwd);
    await rm(dir, { recursive: true, force: true });
  });

  function capture(): { cli: Cli; out(): string } {
    let text = '';
    const cli = createCli({ write: (t) => { text += t; }, writeError: (t) => { text += t; } });
    return { cli, out: () => text };
  }

  it('refuses to add before init', async () => {
    const { cli, out } = capture();
    expect(await cli.run(['add', 'status-dot'])).toBe(1);
    expect(out()).toContain('textui init');
  });

  it('initialises with the chosen directories', async () => {
    const { cli } = capture();
    expect(await cli.run(['init', '--yes', '--components', 'app/ui'])).toBe(0);

    expect(existsSync(join(dir, 'textui.config.json'))).toBe(true);
    expect(existsSync(join(dir, 'app/ui'))).toBe(true);

    const config = JSON.parse(await readFile(join(dir, 'textui.config.json'), 'utf8'));
    expect(config.componentsDir).toBe('app/ui');
  });

  it('refuses to initialise twice', async () => {
    const { cli, out } = capture();
    await cli.run(['init', '--yes']);
    expect(await cli.run(['init', '--yes'])).toBe(1);
    expect(out()).toContain('already initialised');
  });

  it('copies a component and its dependencies, and records a receipt', async () => {
    const { cli, out } = capture();
    await cli.run(['init', '--yes']);
    expect(await cli.run(['add', 'service-table', '--yes'])).toBe(0);

    expect(existsSync(join(dir, 'src/ui/service-table.tsx'))).toBe(true);
    expect(existsSync(join(dir, 'src/ui/status-dot.tsx'))).toBe(true);
    expect(out()).toContain('dependencies: status-dot');

    const receipt = await readReceipt(dir);
    expect(receipt['service-table']?.version).toBe('0.1.0');
    expect(receipt['status-dot']).toBeDefined();
  });

  it('writes nothing on a dry run', async () => {
    const { cli, out } = capture();
    await cli.run(['init', '--yes']);
    await cli.run(['add', 'status-dot', '--dry-run']);

    expect(existsSync(join(dir, 'src/ui/status-dot.tsx'))).toBe(false);
    expect(out()).toContain('Dry run');
  });

  it('leaves a file you have edited alone', async () => {
    const { cli, out } = capture();
    await cli.run(['init', '--yes']);
    await cli.run(['add', 'status-dot', '--yes']);

    const path = join(dir, 'src/ui/status-dot.tsx');
    await writeFile(path, '// my own version\n', 'utf8');

    expect(await cli.run(['add', 'status-dot', '--yes'])).toBe(1);
    expect(out()).toContain('you have edited this');
    expect(await readFile(path, 'utf8')).toBe('// my own version\n');
  });

  it('replaces an edited file when forced', async () => {
    const { cli } = capture();
    await cli.run(['init', '--yes']);
    await cli.run(['add', 'status-dot', '--yes']);

    const path = join(dir, 'src/ui/status-dot.tsx');
    await writeFile(path, '// mine\n', 'utf8');

    expect(await cli.run(['add', 'status-dot', '--yes', '--force'])).toBe(0);
    expect(await readFile(path, 'utf8')).toContain('StatusDot');
  });

  it('rewrites the runtime import to the configured alias', async () => {
    const { cli } = capture();
    await cli.run(['init', '--yes']);
    await writeFile(
      join(dir, 'textui.config.json'),
      JSON.stringify({ componentsDir: 'src/ui', templatesDir: 'src/screens', alias: '~/textui' }),
      'utf8',
    );
    await cli.run(['add', 'status-dot', '--yes']);

    const source = await readFile(join(dir, 'src/ui/status-dot.tsx'), 'utf8');
    expect(source).toContain("from '~/textui'");
    expect(source).not.toContain("from '@textui/core'");
  });

  it('reports drift after an edit', async () => {
    const { cli, out } = capture();
    await cli.run(['init', '--yes']);
    await cli.run(['add', 'status-dot', '--yes']);
    await writeFile(join(dir, 'src/ui/status-dot.tsx'), '// changed\n', 'utf8');

    await cli.run(['diff']);
    expect(out()).toContain('modified');
  });

  it('reports a missing file', async () => {
    const { cli, out } = capture();
    await cli.run(['init', '--yes']);
    await cli.run(['add', 'status-dot', '--yes']);
    await rm(join(dir, 'src/ui/status-dot.tsx'));

    expect(await cli.run(['diff'])).toBe(1);
    expect(out()).toContain('missing');
  });

  it('registers another registry', async () => {
    const { cli, out } = capture();
    await cli.run(['init', '--yes']);

    const other = join(dir, 'my-registry');
    await mkdir(other, { recursive: true });
    await writeFile(
      join(other, 'registry.json'),
      JSON.stringify({ name: 'mine', version: '1.0.0', components: [] }),
      'utf8',
    );

    expect(await cli.run(['registry', 'add', 'mine', other])).toBe(0);
    await cli.run(['registry', 'list']);
    expect(out()).toContain('mine');
  });

  it('sets the project theme', async () => {
    const { cli } = capture();
    await cli.run(['init', '--yes']);
    expect(await cli.run(['theme', '--set', 'workbench'])).toBe(0);

    const config = JSON.parse(await readFile(join(dir, 'textui.config.json'), 'utf8'));
    expect(config.theme).toBe('workbench');
  });

  it('refuses an unknown theme', async () => {
    const { cli, out } = capture();
    await cli.run(['init', '--yes']);
    expect(await cli.run(['theme', '--set', 'neon'])).toBe(1);
    expect(out()).toContain('unknown theme');
  });
});

describe('doctor and previews', () => {
  function capture(): { cli: Cli; out(): string } {
    let text = '';
    const cli = createCli({ write: (t) => { text += t; }, writeError: (t) => { text += t; } });
    return { cli, out: () => text };
  }

  it('reports capabilities', async () => {
    const { cli, out } = capture();
    expect(await cli.run(['doctor'])).toBe(0);
    expect(out()).toContain('Capabilities');
    expect(out()).toContain('colorDepth');
  });

  it('reports as json', async () => {
    const { cli, out } = capture();
    await cli.run(['doctor', '--json']);
    const parsed = JSON.parse(out());
    expect(parsed.capabilities).toBeDefined();
  });

  it('renders a theme preview without a terminal', async () => {
    const { cli, out } = capture();
    expect(await cli.run(['theme', 'console', '--width', '50'])).toBe(0);
    expect(out()).toContain('Theme preview');
    expect(out()).toContain('progress');
  });

  it('lists the built-in catalog', async () => {
    const { cli, out } = capture();
    await cli.run(['list', '--catalog']);
    expect(out()).toContain('Sparkline');
    expect(out()).toContain('Table');
  });
});

describe('hashing', () => {
  it('is stable and content-sensitive', () => {
    expect(hashContent('abc')).toBe(hashContent('abc'));
    expect(hashContent('abc')).not.toBe(hashContent('abd'));
  });
});

describe('CliError', () => {
  it('carries an exit code', () => {
    expect(new CliError('nope', 3).exitCode).toBe(3);
  });
});
