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
  /**
   * Missing keys fall back to the fallback locale, then to `fallback` (the
   * text a component draws when nobody translated it), then to the key itself.
   */
  t(key: string, values?: Record<string, unknown>, fallback?: string): string;
  /** Intl-backed; TextUI does not reimplement formatting. */
  number(value: number, options?: Intl.NumberFormatOptions): string;
  date(value: Date | number, options?: Intl.DateTimeFormatOptions): string;
  relative(value: number, unit: Intl.RelativeTimeFormatUnit): string;
  list(items: string[], options?: Intl.ListFormatOptions): string;
  /**
   * The form the locale's plural rules pick for `count`, with `{count}` and
   * anything the sentence needs around it.
   *
   * `values` carries what else the form names - a limit, a glyph, the total a
   * count is out of - because a sentence that inflects a noun is the whole
   * sentence and not a noun with a number in front of it.
   */
  plural(count: number, forms: Record<string, string>, values?: Record<string, unknown>): string;
  onChange(fn: (locale: LocaleId) => void): Disposable;
}
