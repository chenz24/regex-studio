import type { ReactNode } from 'react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Footer } from '@/components/layout/Footer';
import { useTheme } from '@/hooks/useTheme';
import { localizedPath, useLocale, useT } from '@/lib/i18n';

export function LearnLayout({ children }: { children: ReactNode }) {
  const locale = useLocale();
  const t = useT();
  const { isDark, toggle } = useTheme();
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <header className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <a href={localizedPath('/', locale)} className="text-lg font-bold tracking-tight">
            <span className="text-teal-600 dark:text-teal-400">Regex</span>Studio
          </a>
          <nav aria-label={t.learn_nav()} className="flex items-center gap-2 sm:gap-4">
            <a href={localizedPath('/learn', locale)} className="text-sm hover:underline">
              {t.content_tutorials()}
            </a>
            <a href={localizedPath('/challenges', locale)} className="text-sm hover:underline">
              {t.content_challenges()}
            </a>
            <LanguageSwitcher />
            <ThemeToggle isDark={isDark} onToggle={toggle} />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">{children}</main>
      <Footer />
    </div>
  );
}
