import { Check, ChevronRight, Trophy } from 'lucide-react';
import { CHALLENGES } from '@/challenges/data';
import { useChallengeStore } from '@/stores/challengeStore';
import type { ChallengeDifficulty } from '@/challenges/types';
import { useT, type Messages } from '@/lib/i18n';

function difficultyLabel(t: Messages, d: ChallengeDifficulty): string {
  if (d === 'beginner') return t.chal_diff_beginner();
  if (d === 'intermediate') return t.chal_diff_intermediate();
  return t.chal_diff_advanced();
}

const DIFFICULTY_CLASS: Record<ChallengeDifficulty, string> = {
  beginner: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  intermediate: 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  advanced: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
};

export function ChallengeCatalog() {
  const t = useT();
  const completion = useChallengeStore((s) => s.completion);
  const startChallenge = useChallengeStore((s) => s.startChallenge);

  const solvedCount = Object.keys(completion).length;
  const total = CHALLENGES.length;

  return (
    <div className="px-4 py-4 space-y-4">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {t.chal_catalog_intro({ solved: String(solvedCount), total: String(total) })}
      </p>

      <ul className="space-y-2">
        {CHALLENGES.map((c) => {
          const solved = !!completion[c.id];
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => startChallenge(c.id)}
                className="w-full flex items-start gap-3 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-800 hover:border-amber-300 dark:hover:border-amber-700 hover:bg-amber-50/40 dark:hover:bg-amber-900/10 transition-colors text-left"
              >
                <div
                  className={`flex items-center justify-center w-6 h-6 rounded-full flex-shrink-0 ${
                    solved
                      ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                  }`}
                >
                  {solved ? <Check className="w-3.5 h-3.5" /> : <Trophy className="w-3 h-3" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {c.title}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${DIFFICULTY_CLASS[c.difficulty]}`}
                    >
                      {difficultyLabel(t, c.difficulty)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {c.summary}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 mt-1" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
