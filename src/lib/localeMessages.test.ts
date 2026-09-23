import { describe, expect, it } from 'vitest';
import en from '../../messages/en.json';
import zh from '../../messages/zh.json';
import ja from '../../messages/ja.json';
import { locales } from '@/paraglide/runtime';
import { HTML_LANG, OG_LOCALE } from './localeMetadata';

describe('locale completeness', () => {
  for (const [locale, messages] of Object.entries({ en, zh, ja })) {
    it(`${locale} has every UI message and preserves substitution parameters`, () => {
      expect(Object.keys(messages).sort()).toEqual(Object.keys(en).sort());
      for (const [key, message] of Object.entries(messages)) {
        expect(message.trim(), key).not.toBe('');
        const params = (value: string) => [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
        expect(params(message), key).toEqual(params(en[key as keyof typeof en]));
      }
    });
  }
  it('provides search metadata for every enabled locale', () => {
    expect(Object.keys(HTML_LANG).sort()).toEqual([...locales].sort());
    expect(Object.keys(OG_LOCALE).sort()).toEqual([...locales].sort());
  });
});
