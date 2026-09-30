import { describe, expect, it } from 'vitest';
import { h } from '@textui/core';
import type { TextUIApp } from '@textui/core';
import { renderApp } from '@textui/testing';
import type { Harness } from '@textui/testing';
import { Column, CommandPalette } from '@textui/widgets';
import { ChatComposer } from '../src/index.js';

/**
 * The words a component draws on its own go through the app's i18n.
 *
 * English is what a component says when nobody registered a bundle; a bundle
 * for the app's locale replaces it, and switching locale redraws.
 */

const PT_BR = {
  locale: 'pt-BR',
  messages: {
    'textui.palette.placeholder': 'Digite um comando{ellipsis}',
    'textui.composer.placeholder': 'Pergunte qualquer coisa ao agente',
  },
};

const open = async (onBoot?: (app: TextUIApp) => void): Promise<Harness> => {
  const t = await renderApp({
    width: 80,
    height: 24,
    ...(onBoot ? { onBoot } : {}),
    root: h(Column, { gap: 1 },
      h(CommandPalette, { commands: [] }),
      h(ChatComposer, { value: '', onChange: () => undefined, onSubmit: () => undefined })),
  });
  await t.settle();
  return t;
};

describe('component text is translatable', () => {
  it('draws English without a bundle', async () => {
    const t = await open();
    expect(t.hasText('Type a command')).toBe(true);
    expect(t.hasText('Ask the agent anything')).toBe(true);
    await t.unmount();
  });

  it('draws the pt-BR bundle once the locale is set', async () => {
    const t = await open((app) => {
      app.i18n.register(PT_BR);
      app.i18n.setLocale('pt-BR');
    });
    expect(t.hasText('Digite um comando')).toBe(true);
    expect(t.hasText('Pergunte qualquer coisa ao agente')).toBe(true);
    expect(t.hasText('Type a command')).toBe(false);
    expect(t.hasText('Ask the agent anything')).toBe(false);
    await t.unmount();
  });

  it('redraws when the locale changes after the first frame', async () => {
    const t = await open((app) => { app.i18n.register(PT_BR); });
    expect(t.hasText('Type a command')).toBe(true);
    t.app.i18n.setLocale('pt-BR');
    await t.settle();
    expect(t.hasText('Digite um comando')).toBe(true);
    expect(t.hasText('Pergunte qualquer coisa ao agente')).toBe(true);
    await t.unmount();
  });
});
