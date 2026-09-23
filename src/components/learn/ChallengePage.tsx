import { getChallenges } from '@/challenges/data';
import { localizedPath, useLocale, useT } from '@/lib/i18n';
import { MarkdownLite } from '@/components/tutorial/MarkdownLite';
import { plainTitle } from '@/content/publicCatalog';
import { LearnLayout } from './LearnLayout';
import { ModeSwitch } from './ModeSwitch';

export function ChallengePage({ id }: { id: string }) {
  const locale = useLocale();
  const t = useT();
  const challenges = getChallenges(locale);
  const challenge = challenges.find((item) => item.id === id)!;
  return (
    <LearnLayout>
      <article className="max-w-3xl">
        <a
          href={localizedPath('/challenges', locale)}
          className="text-sm text-teal-700 hover:underline dark:text-teal-300"
        >
          {t.content_challenges()}
        </a>
        <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">
          {plainTitle(challenge.title)}
        </h1>
        <p className="my-5 leading-8 text-gray-600 dark:text-gray-300">
          {plainTitle(challenge.summary)}
        </p>
        <ModeSwitch
          mode="reading"
          readingPath={`/challenges/${id}`}
          practiceQuery={`challenge=${id}`}
        />
        <section className="mt-8 [&>div]:text-base [&_p]:leading-8 [&_code]:break-words">
          <MarkdownLite source={challenge.description} />
        </section>
        <section className="mt-8">
          <h2 className="mb-4 text-xl font-semibold">{t.content_test_cases()}</h2>
          <ul className="space-y-3">
            {challenge.testCases.map((item, index) => (
              <li
                key={index}
                className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="flex flex-wrap justify-between gap-2 text-sm">
                  <h3 className="font-medium">{item.label}</h3>
                  <span className="text-teal-700 dark:text-teal-300">
                    {item.expect === 'match'
                      ? t.chal_runner_expect_match()
                      : t.chal_runner_expect_no_match()}
                  </span>
                </div>
                <pre className="mt-3 whitespace-pre-wrap break-words text-sm text-gray-600 dark:text-gray-400">
                  {item.input || t.chal_runner_empty_input()}
                </pre>
              </li>
            ))}
          </ul>
        </section>
        {challenge.hints && (
          <details className="mt-6 rounded-xl border border-gray-200 p-5 dark:border-gray-800">
            <summary className="cursor-pointer font-semibold">{t.content_hints()}</summary>
            {challenge.hints.map((hint) => (
              <MarkdownLite key={hint} source={hint} />
            ))}
          </details>
        )}
        {challenge.idealSolution && (
          <details className="mt-6 rounded-xl border border-gray-200 p-5 dark:border-gray-800">
            <summary className="cursor-pointer font-semibold">{t.content_solution()}</summary>
            <pre className="my-4 overflow-x-auto rounded-lg bg-gray-950 p-4 text-sm text-teal-200">
              <code>
                /{challenge.idealSolution.pattern}/
                {challenge.idealSolution.flags ?? challenge.starterFlags ?? ''}
              </code>
            </pre>
            {challenge.idealSolution.explanation && (
              <MarkdownLite source={challenge.idealSolution.explanation} />
            )}
          </details>
        )}
        <a
          href={`${localizedPath('/', locale)}?challenge=${id}`}
          className="mt-8 inline-block rounded-lg bg-teal-700 px-5 py-3 font-semibold text-white hover:bg-teal-800"
        >
          {t.content_start_challenge()} &rarr;
        </a>
        <nav
          aria-label={t.learn_related()}
          className="mt-10 border-t border-gray-200 pt-6 dark:border-gray-800"
        >
          <h2 className="mb-4 font-semibold">{t.content_more_challenges()}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {challenges
              .filter((item) => item.id !== id)
              .map((item) => (
                <li key={item.id}>
                  <a
                    href={localizedPath(`/challenges/${item.id}`, locale)}
                    className="text-teal-700 hover:underline dark:text-teal-300"
                  >
                    {plainTitle(item.title)}
                  </a>
                </li>
              ))}
          </ul>
        </nav>
      </article>
    </LearnLayout>
  );
}
