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
});
