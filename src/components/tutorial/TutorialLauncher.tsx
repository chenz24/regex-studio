import { GraduationCap } from 'lucide-react';
import { useTutorialStore } from '@/stores/tutorialStore';
import { totalCompleted, totalLessons } from '@/tutorial/registry';
import { useT } from '@/lib/i18n';

interface Props {
  onOpen?: () => void;
}

export function TutorialLauncher({ onOpen }: Props) {
  const t = useT();
  const view = useTutorialStore((s) => s.view);
  const completion = useTutorialStore((s) => s.completion);
  const openCatalog = useTutorialStore((s) => s.openCatalog);

  const total = totalLessons();
  const done = totalCompleted({ version: 1, completion });
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
          ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300'
          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
      }`}
      title={t.tut_launcher_title()}
    >
      <GraduationCap className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">{t.tut_launcher_label()}</span>
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
