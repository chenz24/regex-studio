import { getTracks } from '@/tutorial/registry';
import { localizedPath, useLocale, useT } from '@/lib/i18n';
import { plainTitle } from '@/content/publicCatalog';
import { LearnLayout } from './LearnLayout';
import { ModeSwitch } from './ModeSwitch';

export function LearnIndex() {
  const t = useT();
  const locale = useLocale();
  const tracks = getTracks(locale);
  return (
    <LearnLayout>
      <h1 className="text-3xl font-bold sm:text-4xl">{t.learn_title()}</h1>
      <p className="my-5 max-w-2xl leading-8 text-gray-600 dark:text-gray-300">
        {t.learn_description()}
      </p>
      <ModeSwitch mode="reading" readingPath="/learn" practiceQuery="catalog=tutorial" />
      {tracks.map((track) => (
        <section key={track.id} className="mt-10">
          <h2 className="text-xl font-semibold">{plainTitle(track.title)}</h2>
          <p className="mb-5 mt-2 text-gray-600 dark:text-gray-400">
            {plainTitle(track.description)}
          </p>
          <ol className="grid gap-4 sm:grid-cols-2">
            {track.lessons.map((lesson) => (
              <li key={lesson.id}>
                <a
                  href={localizedPath(`/learn/${lesson.id}`, locale)}
                  className="block h-full rounded-xl border border-gray-200 bg-white p-5 hover:border-teal-500 dark:border-gray-800 dark:bg-gray-900"
                >
                  <h3 className="font-semibold">{plainTitle(lesson.title)}</h3>
                  <p className="my-3 text-sm leading-7 text-gray-600 dark:text-gray-400">
                    {plainTitle(lesson.summary)}
                  </p>
                  <p className="text-xs text-teal-700 dark:text-teal-300">
                    {t.tut_catalog_lesson_meta({
                      minutes: String(lesson.estimatedMinutes),
                      steps: String(lesson.steps.length),
                    })}
                  </p>
                </a>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </LearnLayout>
  );
}
