import { Trophy } from 'lucide-react';
import { useChallengeStore } from '@/stores/challengeStore';
import { CHALLENGES } from '@/challenges/data';
import { useT } from '@/lib/i18n';

interface Props {
  onOpen?: () => void;
}

export function ChallengesLauncher({ onOpen }: Props) {
  const t = useT();
  const view = useChallengeStore((s) => s.view);
  const completion = useChallengeStore((s) => s.completion);
  const openCatalog = useChallengeStore((s) => s.openCatalog);

  const total = CHALLENGES.length;
  const done = Object.keys(completion).length;
  const isOpen = view !== 'closed';

  return (
    <button
      type="button"
      onClick={() => {
        openCatalog();
        onOpen?.();
      }}
      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
        isOpen
          ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
      }`}
      title={t.chal_launcher_title()}
    >
      <Trophy className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">{t.chal_launcher_label()}</span>
      {total > 0 && (
        <span
          className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold ${
            done === total
              ? 'bg-emerald-500 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
        >
          {done}/{total}
        </span>
      )}
    </button>
  );
}
