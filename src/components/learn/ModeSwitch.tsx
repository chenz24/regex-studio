import { localizedPath, useLocale, useT } from '@/lib/i18n';

export function ModeSwitch({
  mode,
  readingPath,
  practiceQuery,
}: {
  mode: 'reading' | 'practice';
  readingPath: string;
  practiceQuery: string;
}) {
  const t = useT();
  const locale = useLocale();
  return (
    <nav
      aria-label={t.content_mode_label()}
      className="flex flex-wrap items-center gap-1 rounded-lg bg-gray-100 p-1 text-sm dark:bg-gray-800"
    >
      {(['practice', 'reading'] as const).map((item) => {
        const label = item === 'practice' ? t.content_mode_practice() : t.content_mode_reading();
        const style = 'rounded-md px-3 py-2 font-medium';
        return item === mode ? (
          <span
            key={item}
            aria-current="page"
            className={`${style} bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white`}
          >
            {label}
          </span>
        ) : (
          <a
            key={item}
            href={
              item === 'reading'
                ? localizedPath(readingPath, locale)
                : `${localizedPath('/', locale)}?${practiceQuery}`
            }
            className={`${style} text-teal-700 hover:bg-white dark:text-teal-300 dark:hover:bg-gray-700`}
          >
            {label} &rarr;
          </a>
        );
      })}
    </nav>
  );
}
