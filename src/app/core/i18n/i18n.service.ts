import { Injectable, computed, signal } from '@angular/core';
import { Locale } from '../models';
import { storage } from '../storage';
import { de } from './de';
import { en } from './en';
import { hu } from './hu';

const DICTIONARIES: Record<Locale, unknown> = { hu, en, de };
const INTL_LOCALES: Record<Locale, string> = { hu: 'hu-HU', en: 'en-GB', de: 'de-DE' };

export const LOCALES: { code: Locale; label: string }[] = [
  { code: 'hu', label: 'Magyar' },
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
];

function detectLocale(): Locale {
  const stored = storage.get('uf.locale') as Locale | null;
  if (stored && stored in DICTIONARIES) {
    return stored;
  }
  const browser = (navigator.language || 'hu').slice(0, 2) as Locale;
  return browser in DICTIONARIES ? browser : 'hu';
}

/**
 * Runtime switchable translations (hu / en / de) plus locale aware formatting helpers.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  readonly locale = signal<Locale>(detectLocale());
  readonly intlLocale = computed(() => INTL_LOCALES[this.locale()]);

  constructor() {
    document.documentElement.lang = this.locale();
  }

  use(locale: Locale): void {
    if (!(locale in DICTIONARIES)) {
      return;
    }
    this.locale.set(locale);
    storage.set('uf.locale', locale);
    document.documentElement.lang = locale;
  }

  t(key: string, params?: Record<string, string | number | null | undefined>): string {
    const value = this.lookup(DICTIONARIES[this.locale()], key) ?? this.lookup(DICTIONARIES.hu, key);
    if (typeof value !== 'string') {
      return key;
    }
    return params ? value.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? '')) : value;
  }

  /** Non-string dictionary values (lists such as FAQ entries). */
  raw<T>(key: string): T {
    return (this.lookup(DICTIONARIES[this.locale()], key) ?? this.lookup(DICTIONARIES.hu, key)) as T;
  }

  has(key: string): boolean {
    return typeof this.lookup(DICTIONARIES[this.locale()], key) === 'string';
  }

  date(value: string | Date | null | undefined, timeZone?: string, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }): string {
    if (!value) {
      return '–';
    }
    return new Intl.DateTimeFormat(this.intlLocale(), { ...options, timeZone }).format(new Date(value));
  }

  dateTime(value: string | Date | null | undefined, timeZone?: string): string {
    return this.date(value, timeZone, { dateStyle: 'medium', timeStyle: 'short' });
  }

  money(value: number | null | undefined, currency = 'HUF'): string {
    return new Intl.NumberFormat(this.intlLocale(), {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'HUF' ? 0 : 2,
    }).format(value ?? 0);
  }

  number(value: number | null | undefined): string {
    return new Intl.NumberFormat(this.intlLocale()).format(value ?? 0);
  }

  relative(value: string | Date | null | undefined): string {
    if (!value) {
      return '–';
    }
    const diff = (new Date(value).getTime() - Date.now()) / 1000;
    const formatter = new Intl.RelativeTimeFormat(this.intlLocale(), { numeric: 'auto' });
    const units: [Intl.RelativeTimeFormatUnit, number][] = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
    for (const [unit, seconds] of units) {
      if (Math.abs(diff) >= seconds) {
        return formatter.format(Math.round(diff / seconds), unit);
      }
    }
    return formatter.format(Math.round(diff), 'second');
  }

  private lookup(dictionary: unknown, key: string): unknown {
    return key.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), dictionary);
  }
}
