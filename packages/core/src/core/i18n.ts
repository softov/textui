import type { I18n, LocaleId, TranslationBundle } from '../types/i18n.js';
import type { Disposable } from '../types/disposable.js';
import { toDisposable } from '../util/disposable.js';

function lookup(messages: Record<string, unknown>, key: string): string | undefined {
  if (key in messages) {
    const direct = messages[key];
    return typeof direct === 'string' ? direct : undefined;
  }
  let cursor: unknown = messages;
  for (const part of key.split('.')) {
    if (cursor === null || typeof cursor !== 'object') return undefined;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return typeof cursor === 'string' ? cursor : undefined;
}

function interpolate(template: string, values: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}

/**
 * Lightweight i18n. Formatting is `Intl`'s job - recreating number, date and
 * list formatting would be a second, worse implementation of something the
 * runtime already ships.
 */
export class I18nRegistry implements I18n {
  locale: LocaleId;
  private bundles = new Map<LocaleId, Record<string, unknown>>();
  private listeners = new Set<(locale: LocaleId) => void>();

  constructor(
    locale: LocaleId = 'en',
    private fallbackLocale: LocaleId = 'en',
  ) {
    this.locale = locale;
  }

  setLocale(locale: LocaleId): void {
    if (this.locale === locale) return;
    this.locale = locale;
    for (const fn of [...this.listeners]) fn(locale);
  }

  register(bundle: TranslationBundle): Disposable {
    const existing = this.bundles.get(bundle.locale) ?? {};
    this.bundles.set(bundle.locale, { ...existing, ...bundle.messages });
    if (this.locale === bundle.locale) {
      for (const fn of [...this.listeners]) fn(this.locale);
    }
    return toDisposable(() => this.bundles.delete(bundle.locale));
  }

  locales(): LocaleId[] {
    return [...this.bundles.keys()];
  }

  /** Missing keys fall through to the fallback locale, then to the key. */
  t(key: string, values?: Record<string, unknown>): string {
    const primary = this.bundles.get(this.locale);
    const base = this.locale.includes('-')
      ? this.bundles.get(this.locale.split('-')[0] as string)
      : undefined;
    const fallback = this.bundles.get(this.fallbackLocale);

    const template =
      (primary && lookup(primary, key)) ??
      (base && lookup(base, key)) ??
      (fallback && lookup(fallback, key)) ??
      key;

    return values ? interpolate(template, values) : template;
  }

  number(value: number, options?: Intl.NumberFormatOptions): string {
    return new Intl.NumberFormat(this.locale, options).format(value);
  }

  date(value: Date | number, options?: Intl.DateTimeFormatOptions): string {
    return new Intl.DateTimeFormat(this.locale, options).format(value);
  }

  relative(value: number, unit: Intl.RelativeTimeFormatUnit): string {
    return new Intl.RelativeTimeFormat(this.locale, { numeric: 'auto' }).format(value, unit);
  }

  list(items: string[], options?: Intl.ListFormatOptions): string {
    return new Intl.ListFormat(this.locale, options).format(items);
  }

  plural(count: number, forms: Record<string, string>): string {
    const rule = new Intl.PluralRules(this.locale).select(count);
    const template = forms[rule] ?? forms.other ?? '';
    return interpolate(template, { count });
  }

  onChange(fn: (locale: LocaleId) => void): Disposable {
    this.listeners.add(fn);
    return toDisposable(() => this.listeners.delete(fn));
  }
}

export function createI18n(locale?: string, fallback?: string): I18nRegistry {
  return new I18nRegistry(locale, fallback);
}
