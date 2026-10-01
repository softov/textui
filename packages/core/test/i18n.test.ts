import { describe, expect, it } from 'vitest';
import { createI18n } from '../src/core/i18n.js';

describe('i18n', () => {
  it('uses the fallback text when no bundle has the key', () => {
    const i18n = createI18n('pt-BR');
    expect(i18n.t('textui.x.missing', undefined, 'Nothing here')).toBe('Nothing here');
    expect(i18n.t('textui.x.count', { count: 3 }, '{count} left')).toBe('3 left');
  });

  it('prefers any bundle over the fallback text', () => {
    const i18n = createI18n('pt-BR');
    i18n.register({ locale: 'en', messages: { 'textui.x.hello': 'Hi' } });
    expect(i18n.t('textui.x.hello', undefined, 'Hello')).toBe('Hi');
    i18n.register({ locale: 'pt', messages: { 'textui.x.hello': 'Oi' } });
    expect(i18n.t('textui.x.hello', undefined, 'Hello')).toBe('Oi');
    i18n.register({ locale: 'pt-BR', messages: { textui: { x: { hello: 'Olá, {name}' } } } });
    expect(i18n.t('textui.x.hello', { name: 'Ana' }, 'Hello')).toBe('Olá, Ana');
  });

  it('returns the key when there is neither a bundle nor fallback text', () => {
    const i18n = createI18n();
    expect(i18n.t('textui.x.missing')).toBe('textui.x.missing');
  });

  it('picks the plural form the locale asks for', () => {
    const i18n = createI18n('en');
    const files = (count: number): string =>
      i18n.plural(count, { one: '{count} file', other: '{count} files' });
    expect(files(1)).toBe('1 file');
    expect(files(2)).toBe('2 files');
    expect(files(0)).toBe('0 files');
  });

  it('fills the rest of the sentence around the count', () => {
    const i18n = createI18n('en');
    const left = (count: number, glyph: string): string =>
      i18n.plural(count, { one: '{glyph} {count} more line', other: '{glyph} {count} more lines' }, { glyph });
    expect(left(1, '…')).toBe('… 1 more line');
    expect(left(5, '…')).toBe('… 5 more lines');
  });

  it('selects on the number the noun agrees with, not the one it prints', () => {
    const i18n = createI18n('en');
    const of = (shown: number, total: number): string =>
      i18n.plural(total, { one: '{shown} of {total} frame', other: '{shown} of {total} frames' }, { shown, total });
    expect(of(1, 1)).toBe('1 of 1 frame');
    expect(of(1, 5)).toBe('1 of 5 frames');
  });
});
