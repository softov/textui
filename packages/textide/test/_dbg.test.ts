import { describe, it } from 'vitest';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderApp } from '@textui/testing';
import { loadWorkspace, registerTextide } from '../src/index.js';

describe('dbg', () => {
  for (const size of [{ width: 96, height: 16 }, { width: 130, height: 22 }]) {
    it(`frame ${size.width}x${size.height}`, async () => {
      const dir = await mkdtemp(join(tmpdir(), 'tid-'));
      await writeFile(join(dir, 'a.md'), '# hi\n');
      await mkdir(join(dir, 'src'));
      await writeFile(join(dir, 'src', 'x.ts'), 'export const x = 1;\n');
      const workspace = await loadWorkspace(dir);
      const t = await renderApp({
        ...size, shell: 'workbench', theme: 'workbench',
        onBoot: (app) => registerTextide(app, { workspace }),
      });
      for (let i = 0; i < 8; i++) await t.settle();
      console.log('--- ' + size.width + 'x' + size.height + ' ---');
      console.log(t.lines().join('\n'));

      await t.app.execute('menu.view');
      for (let i = 0; i < 4; i++) await t.settle();
      console.log('--- view menu open ---');
      console.log(t.lines().join('\n'));
      await t.unmount();
    });
  }
});
