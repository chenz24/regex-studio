import { Check, Languages } from 'lucide-react';
import { setLocaleAndNavigate, useLocale, useT } from '@/lib/i18n';
import type { Locale } from '@/paraglide/runtime';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type LocaleLabelKey = 'language_english' | 'language_chinese';

const LOCALES: Array<{ code: Locale; labelKey: LocaleLabelKey; short: string }> = [
  { code: 'en', labelKey: 'language_english', short: 'EN' },
  { code: 'zh', labelKey: 'language_chinese', short: '中' },
];

export function LanguageSwitcher() {
  const t = useT();
  const current = useLocale();
  const currentLocale = LOCALES.find((l) => l.code === current) ?? LOCALES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t.language_switch_label()}
        title={t.language_switch_label()}
        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 data-[state=open]:bg-gray-100 dark:data-[state=open]:bg-gray-800"
      >
        <Languages className="w-3.5 h-3.5" />
        <span>{currentLocale.short}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[10rem]">
        {LOCALES.map(({ code, labelKey }) => {
          const active = code === current;
          return (
            <DropdownMenuItem
              key={code}
              onSelect={() => {
                if (!active) setLocaleAndNavigate(code);
              }}
              className="justify-between outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0"
            >
              <span>{t[labelKey]()}</span>
              {active && <Check className="w-3.5 h-3.5 text-teal-500" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
