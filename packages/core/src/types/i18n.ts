import type { Disposable } from './disposable.js';

export type LocaleId = string;

export interface TranslationBundle {
  locale: LocaleId;
  /** Flat or nested; nested keys are addressed with dots. */
  messages: Record<string, unknown>;
}

export interface I18n {
  locale: LocaleId;
  setLocale(locale: LocaleId): void;
  register(bundle: TranslationBundle): Disposable;
  locales(): LocaleId[];
  /** Missing keys fall back to the fallback locale, then to the key itself. */
  t(key: string, values?: Record<string, unknown>): string;
  /** Intl-backed; TextUI does not reimplement formatting. */
  number(value: number, options?: Intl.NumberFormatOptions): string;
  date(value: Date | number, options?: Intl.DateTimeFormatOptions): string;
  relative(value: number, unit: Intl.RelativeTimeFormatUnit): string;
  list(items: string[], options?: Intl.ListFormatOptions): string;
  plural(count: number, forms: Record<string, string>): string;
  onChange(fn: (locale: LocaleId) => void): Disposable;
}
