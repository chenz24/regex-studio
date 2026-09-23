import { getChallenges } from '@/challenges/data';
import { plainTitle } from '@/content/publicCatalog';
import { challengeLessons, relatedChallengeIds } from '@/content/relatedLearning';
import { localizedPath, useLocale, useT } from '@/lib/i18n';
import { getTracks } from '@/tutorial/registry';

export function RelatedLearning({ kind, id }: { kind: 'lesson' | 'challenge'; id: string }) {
  const locale = useLocale();
  const t = useT();
  const ids = kind === 'challenge' ? (challengeLessons[id] ?? []) : relatedChallengeIds(id);
  const items =
    kind === 'challenge'
      ? getTracks(locale).flatMap((track) => track.lessons)
      : getChallenges(locale);
  const related = ids
    .map((relatedId) => items.find((item) => item.id === relatedId))
    .filter((item) => item !== undefined);
  if (!related.length) return null;
  return (
    <aside className="mt-10 rounded-xl border border-gray-200 p-5 dark:border-gray-800">
      <h2 className="font-semibold">
        {kind === 'challenge' ? t.content_related_lessons() : t.content_related_challenges()}
      </h2>
      <ul className="mt-3 space-y-3">
        {related.map((item) => (
          <li key={item.id}>
            <a
              href={localizedPath(
                `/${kind === 'challenge' ? 'learn' : 'challenges'}/${item.id}`,
                locale,
              )}
              className="text-teal-700 underline underline-offset-4 dark:text-teal-300"
            >
              {plainTitle(item.title)}
            </a>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {plainTitle(item.summary)}
            </p>
          </li>
        ))}
      </ul>
    </aside>
  );
}
