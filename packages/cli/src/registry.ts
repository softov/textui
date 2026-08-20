import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import type { RegistryComponentManifest, RegistryManifest } from '@textui/core';

/**
 * The registry, and copying out of it.
 *
 * The model is shadcn's: a component's source is copied into the project so
 * the person who has to maintain it owns it. What makes that survivable is the
 * receipt written alongside - origin, version and a content hash - so the CLI
 * can later tell "you have not touched this" from "you changed it", and never
 * overwrite the second kind without being asked.
 */

export interface ProjectConfig {
  $schema?: string;
  /** Where components are copied. */
  componentsDir: string;
  /** Where templates are copied. */
  templatesDir: string;
  /** Import alias the copied source should use for the runtime. */
  alias: string;
  theme?: string;
  shell?: string;
  /** Extra registries, by name. Values are paths or URLs. */
  registries?: Record<string, string>;
  typescript?: boolean;
}

export const DEFAULT_CONFIG: ProjectConfig = {
  componentsDir: 'src/ui',
  templatesDir: 'src/screens',
  alias: '@textui/core',
  theme: 'dark',
  shell: 'plain',
  typescript: true,
};

export const CONFIG_FILES = ['textui.config.json', 'textui.config.ts'];
export const RECEIPT_FILE = '.textui/components.json';

export interface Receipt {
  /** Component name to what was installed. */
  [name: string]: {
    registry: string;
    version: string;
    files: { path: string; hash: string }[];
    installedAt: string;
  };
}

export function hashContent(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex').slice(0, 16);
}

export async function findProjectRoot(from = process.cwd()): Promise<string | null> {
  let dir = resolve(from);
  for (;;) {
    for (const name of CONFIG_FILES) {
      if (existsSync(join(dir, name))) return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export async function readConfig(root: string): Promise<ProjectConfig> {
  const jsonPath = join(root, 'textui.config.json');
  if (existsSync(jsonPath)) {
    const raw = await readFile(jsonPath, 'utf8');
    return { ...DEFAULT_CONFIG, ...(JSON.parse(raw) as Partial<ProjectConfig>) };
  }

  // A `.ts` config is read for its literal object rather than executed: the
  // CLI must work before the project's dependencies are installed.
  const tsPath = join(root, 'textui.config.ts');
  if (existsSync(tsPath)) {
    const raw = await readFile(tsPath, 'utf8');
    const match = /defineConfig\(\s*({[\s\S]*?})\s*\)/.exec(raw);
    if (match) {
      try {
        return { ...DEFAULT_CONFIG, ...(JSON.parse(toJson(match[1] as string)) as Partial<ProjectConfig>) };
      } catch {
        // Fall through to defaults; a config we cannot read is not fatal.
      }
    }
  }
  return { ...DEFAULT_CONFIG };
}

/** A permissive JS-object-literal to JSON conversion. Good enough for a config. */
function toJson(source: string): string {
  return source
    .replace(/\/\/.*$/gm, '')
    .replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":')
    .replace(/'/g, '"')
    .replace(/,(\s*[}\]])/g, '$1');
}

export async function writeConfig(root: string, config: ProjectConfig): Promise<string> {
  const path = join(root, 'textui.config.json');
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  return path;
}

export async function readReceipt(root: string): Promise<Receipt> {
  const path = join(root, RECEIPT_FILE);
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(await readFile(path, 'utf8')) as Receipt;
  } catch {
    return {};
  }
}

export async function writeReceipt(root: string, receipt: Receipt): Promise<void> {
  const path = join(root, RECEIPT_FILE);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
}

/** Where the shipped registry lives, relative to this package. */
export function builtinRegistryDir(): string {
  // dist/registry.js -> packages/cli/dist -> repo root/components
  const here = dirname(new URL(import.meta.url).pathname);
  const candidates = [
    resolve(here, '../../../components'),
    resolve(here, '../../components'),
    resolve(process.cwd(), 'components'),
  ];
  return candidates.find((dir) => existsSync(join(dir, 'registry.json'))) ?? (candidates[0] as string);
}

export async function loadRegistry(source?: string): Promise<{ manifest: RegistryManifest; dir: string }> {
  const dir = source ?? builtinRegistryDir();
  const path = join(dir, 'registry.json');
  if (!existsSync(path)) {
    throw new Error(`no registry.json at ${dir}`);
  }
  const manifest = JSON.parse(await readFile(path, 'utf8')) as RegistryManifest;
  return { manifest, dir };
}

export function findComponent(
  manifest: RegistryManifest,
  name: string,
): RegistryComponentManifest | undefined {
  return manifest.components.find((c) => c.name === name);
}

/** A component plus everything it depends on, dependencies first. */
export function resolveDependencies(
  manifest: RegistryManifest,
  names: string[],
): RegistryComponentManifest[] {
  const out: RegistryComponentManifest[] = [];
  const seen = new Set<string>();

  const visit = (name: string, trail: string[]): void => {
    if (seen.has(name)) return;
    if (trail.includes(name)) {
      throw new Error(`circular dependency: ${[...trail, name].join(' -> ')}`);
    }
    const component = findComponent(manifest, name);
    if (!component) {
      const known = manifest.components.map((c) => c.name).join(', ');
      throw new Error(`unknown component "${name}". Available: ${known}`);
    }
    for (const dep of component.dependencies ?? []) visit(dep, [...trail, name]);
    seen.add(name);
    out.push(component);
  };

  for (const name of names) visit(name, []);
  return out;
}

export interface CopyResult {
  component: string;
  written: string[];
  skipped: { path: string; reason: 'modified' | 'exists' }[];
}

export interface CopyOptions {
  root: string;
  registryDir: string;
  registryName?: string;
  config: ProjectConfig;
  receipt: Receipt;
  force?: boolean;
  dryRun?: boolean;
}

export async function copyComponent(
  component: RegistryComponentManifest,
  options: CopyOptions,
): Promise<CopyResult> {
  const written: string[] = [];
  const skipped: CopyResult['skipped'] = [];
  const recorded: { path: string; hash: string }[] = [];
  const previous = options.receipt[component.name];

  for (const file of component.files) {
    const sourcePath = join(options.registryDir, file.path);
    const targetRelative = file.target ?? join(options.config.componentsDir, basename(file.path));
    const targetPath = join(options.root, targetRelative);

    const source = await readFile(sourcePath, 'utf8');
    const transformed = source.replace(/from '@textui\/core'/g, `from '${options.config.alias}'`);
    const hash = hashContent(transformed);

    if (existsSync(targetPath) && !options.force) {
      const current = await readFile(targetPath, 'utf8');
      const currentHash = hashContent(current);
      const installedHash = previous?.files.find((f) => f.path === targetRelative)?.hash;

      if (currentHash === hash) {
        // Already up to date; nothing to do and nothing to warn about.
        recorded.push({ path: targetRelative, hash });
        continue;
      }
      // Only refuse when the local copy differs from what we installed - an
      // untouched file is safe to update, an edited one is the user's work.
      skipped.push({
        path: targetRelative,
        reason: installedHash && installedHash !== currentHash ? 'modified' : 'exists',
      });
      recorded.push({ path: targetRelative, hash: currentHash });
      continue;
    }

    if (!options.dryRun) {
      await mkdir(dirname(targetPath), { recursive: true });
      await writeFile(targetPath, transformed, 'utf8');
    }
    written.push(targetRelative);
    recorded.push({ path: targetRelative, hash });
  }

  if (!options.dryRun) {
    options.receipt[component.name] = {
      registry: options.registryName ?? 'textui',
      version: component.version,
      files: recorded,
      installedAt: new Date().toISOString(),
    };
  }

  return { component: component.name, written, skipped };
}

function basename(path: string): string {
  return path.split('/').pop() ?? path;
}

export interface DriftReport {
  component: string;
  file: string;
  state: 'unchanged' | 'modified' | 'outdated' | 'missing';
}

/** What has drifted from upstream, and in which direction. */
export async function diffInstalled(
  root: string,
  registryDir: string,
  manifest: RegistryManifest,
  receipt: Receipt,
  config: ProjectConfig,
): Promise<DriftReport[]> {
  const out: DriftReport[] = [];

  for (const [name, entry] of Object.entries(receipt)) {
    const component = findComponent(manifest, name);
    if (!component) continue;

    for (const file of entry.files) {
      const target = join(root, file.path);
      if (!existsSync(target)) {
        out.push({ component: name, file: file.path, state: 'missing' });
        continue;
      }
      const current = hashContent(await readFile(target, 'utf8'));

      const definition = component.files.find(
        (f) => (f.target ?? join(config.componentsDir, basename(f.path))) === file.path,
      );
      const upstreamPath = definition ? join(registryDir, definition.path) : null;
      const upstream = upstreamPath && existsSync(upstreamPath)
        ? hashContent(
            (await readFile(upstreamPath, 'utf8')).replace(/from '@textui\/core'/g, `from '${config.alias}'`),
          )
        : null;

      if (current !== file.hash) {
        out.push({ component: name, file: file.path, state: 'modified' });
      } else if (upstream && upstream !== current) {
        out.push({ component: name, file: file.path, state: 'outdated' });
      } else {
        out.push({ component: name, file: file.path, state: 'unchanged' });
      }
    }
  }

  return out;
}

export async function listSourceFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const walk = async (current: string): Promise<void> => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) await walk(full);
      else out.push(relative(dir, full));
    }
  };
  if (existsSync(dir) && (await stat(dir)).isDirectory()) await walk(dir);
  return out;
}
