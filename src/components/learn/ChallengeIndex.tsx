import { getChallenges } from '@/challenges/data';
import { localizedPath, useLocale, useT } from '@/lib/i18n';
import { plainTitle } from '@/content/publicCatalog';
import { LearnLayout } from './LearnLayout';
import { ModeSwitch } from './ModeSwitch';

export function ChallengeIndex() {
  const locale = useLocale();
  const t = useT();
  return (
    <LearnLayout>
      <h1 className="text-3xl font-bold sm:text-4xl">{t.content_challenges_title()}</h1>
      <p className="my-5 max-w-2xl leading-8 text-gray-600 dark:text-gray-300">
        {t.content_challenges_description()}
      </p>
      <ModeSwitch mode="reading" readingPath="/challenges" practiceQuery="catalog=challenges" />
      <ol className="mt-8 grid gap-4 sm:grid-cols-2">
        {getChallenges(locale).map((challenge) => (
          <li key={challenge.id}>
            <a
              href={localizedPath(`/challenges/${challenge.id}`, locale)}
              className="block h-full rounded-xl border border-gray-200 bg-white p-6 hover:border-amber-500 dark:border-gray-800 dark:bg-gray-900"
            >
              <span className="text-xs text-amber-700 dark:text-amber-300">
                {challenge.difficulty === 'beginner'
                  ? t.chal_diff_beginner()
                  : challenge.difficulty === 'intermediate'
                    ? t.chal_diff_intermediate()
                    : t.chal_diff_advanced()}
              </span>
              <h2 className="my-3 text-lg font-semibold">{plainTitle(challenge.title)}</h2>
              <p className="text-sm leading-7 text-gray-600 dark:text-gray-400">
                {plainTitle(challenge.summary)}
              </p>
            </a>
          </li>
        ))}
      </ol>
    </LearnLayout>
  );
}
