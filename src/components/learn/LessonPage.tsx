import { getTracks } from '@/tutorial/registry';
import { useEffect, useState } from 'react';
import { localizedPath, useLocale, useT } from '@/lib/i18n';
import { MarkdownLite } from '@/components/tutorial/MarkdownLite';
import { ENGINE_FLAVORS } from '@/types/engineTypes';
import { plainTitle } from '@/content/publicCatalog';
import { LearnLayout } from './LearnLayout';
import { ModeSwitch } from './ModeSwitch';
import { ReadingExample } from './ReadingExample';

export function LessonPage({ id }: { id: string }) {
  const locale = useLocale();
  const t = useT();
  // Fragments are not sent to the server. Read them after hydration so the
  // initial client markup matches the server, then follow native TOC links.
  const [hash, setHash] = useState('');
  useEffect(() => {
    const syncHash = () => setHash(window.location.hash.slice(1));
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);
  const tracks = getTracks(locale);
  const lessons = tracks.flatMap((track) => track.lessons);
  const lesson = lessons.find((item) => item.id === id)!;
  const track = tracks.find((item) => item.id === lesson.trackId)!;
  const index = lessons.indexOf(lesson);
  const activeStep = Math.max(
    0,
    lesson.steps.findIndex((step) => step.id === hash),
  );
  let state = lesson.initialState;
  return (
    <LearnLayout>
      <article className="max-w-3xl">
        <a
          href={localizedPath('/learn', locale)}
          className="text-sm text-teal-700 hover:underline dark:text-teal-300"
        >
          {t.content_tutorials()} / {plainTitle(track.title)}
        </a>
        <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">
          {plainTitle(lesson.title)}
        </h1>
        <p className="my-5 text-base leading-8 text-gray-600 dark:text-gray-300">
          {plainTitle(lesson.summary)}
        </p>
        <ModeSwitch
          mode="reading"
          readingPath={`/learn/${id}`}
          practiceQuery={`lesson=${id}&step=${activeStep + 1}`}
        />
        {lesson.reading && (
          <div className="mt-8 [&>div]:text-base [&_p]:leading-8">
            <MarkdownLite source={lesson.reading.introduction} />
          </div>
        )}
        <nav
          aria-label={t.learn_toc()}
          className="my-8 rounded-xl border border-gray-200 p-5 dark:border-gray-800"
        >
          <h2 className="mb-3 font-semibold">{t.learn_toc()}</h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-teal-700 dark:text-teal-300">
            {lesson.steps.map((step) => (
              <li key={step.id}>
                <a className="underline underline-offset-4" href={`#${step.id}`}>
                  {plainTitle(step.reading?.title ?? step.title)}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        {lesson.steps.map((step, stepIndex) => {
          state = { ...state, ...step.setup };
          return (
            <section id={step.id} key={step.id} className="mt-10 scroll-mt-6">
              <h2 className="mb-4 text-xl font-semibold">
                {stepIndex + 1}. {plainTitle(step.reading?.title ?? step.title)}
              </h2>
              <div className="[&>div]:text-base [&_p]:leading-8 [&_code]:break-words">
                <MarkdownLite source={step.reading?.body ?? step.body} />
              </div>
              {step.reading?.examples?.map((example, i) => (
                <ReadingExample key={i} example={example} />
              ))}
              {!step.reading && (stepIndex === 0 || step.setup?.testText !== undefined) && (
                <div className="my-5 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                  <h3 className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                    {t.learn_input()}
                  </h3>
                  <pre className="whitespace-pre-wrap break-words text-sm">{state.testText}</pre>
                </div>
              )}
              {step.flavorCompare?.commentary && (
                <section className="my-5 rounded-xl border border-sky-200 p-5 dark:border-sky-800">
                  <h3 className="font-semibold">{t.compatibility_compare_title()}</h3>
                  {step.flavorCompare.flavors.map((flavor) => {
                    const commentary = step.flavorCompare?.commentary?.[flavor];
                    return commentary ? (
                      <div key={flavor} className="mt-4">
                        <h4 className="font-medium">{ENGINE_FLAVORS[flavor].name}</h4>
                        <MarkdownLite source={commentary} />
                      </div>
                    ) : null;
                  })}
                </section>
              )}
              {!step.reading && step.hints && (
                <details className="my-4 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                  <summary className="cursor-pointer font-medium">{t.content_hints()}</summary>
                  <ul className="mt-3 space-y-2">
                    {step.hints.map((hint) => (
                      <li key={hint}>
                        <MarkdownLite source={hint} />
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {!step.reading && step.solution && (
                <details className="my-4 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                  <summary className="cursor-pointer font-medium">{t.content_solution()}</summary>
                  <pre className="mt-3 overflow-x-auto rounded-lg bg-gray-950 p-4 text-sm text-teal-200">
                    <code>
                      /{step.solution.pattern}/{step.solution.flags ?? state.flags ?? ''}
                    </code>
                  </pre>
                  {step.solution.explanation && <MarkdownLite source={step.solution.explanation} />}
                </details>
              )}
              <a
                href={`${localizedPath('/', locale)}?lesson=${id}&step=${stepIndex + 1}`}
                className="my-4 inline-block font-medium text-teal-700 underline underline-offset-4 dark:text-teal-300"
              >
                {t.content_practice_step()} &rarr;
              </a>
            </section>
          );
        })}
        {lesson.reading && (
          <aside className="mt-10 rounded-xl border border-gray-200 p-5 dark:border-gray-800">
            <h2 className="font-semibold">{t.reading_references()}</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {lesson.reading.references.map((reference) => (
                <li key={reference.url}>
                  <a
                    href={reference.url}
                    className="text-teal-700 underline underline-offset-4 dark:text-teal-300"
                  >
                    {reference.title}
                  </a>
                </li>
              ))}
            </ul>
          </aside>
        )}
        <nav
          aria-label={t.learn_related()}
          className="mt-10 flex flex-wrap justify-between gap-4 border-t border-gray-200 pt-6 dark:border-gray-800"
        >
          {lessons[index - 1] && (
            <a
              href={localizedPath(`/learn/${lessons[index - 1].id}`, locale)}
              className="text-teal-700 hover:underline dark:text-teal-300"
            >
              &larr; {plainTitle(lessons[index - 1].title)}
            </a>
          )}
          {lessons[index + 1] && (
            <a
              href={localizedPath(`/learn/${lessons[index + 1].id}`, locale)}
              className="text-teal-700 hover:underline dark:text-teal-300"
            >
              {plainTitle(lessons[index + 1].title)} &rarr;
            </a>
          )}
        </nav>
      </article>
    </LearnLayout>
  );
}
