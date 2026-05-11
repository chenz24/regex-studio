import { useEffect } from 'react';
import { RotateCcw, Trophy, X } from 'lucide-react';
import { useChallengeStore } from '@/stores/challengeStore';
import { ChallengeCatalog } from './ChallengeCatalog';
import { ChallengeRunner } from './ChallengeRunner';
import { useT } from '@/lib/i18n';

export function ChallengesDrawer() {
  const t = useT();
  const view = useChallengeStore((s) => s.view);
  const close = useChallengeStore((s) => s.close);
  const completion = useChallengeStore((s) => s.completion);
  const resetAll = useChallengeStore((s) => s.resetAll);
  const isOpen = view !== 'closed';
  const hasAnyProgress = Object.keys(completion).length > 0;

  const handleResetAll = () => {
    if (typeof window !== 'undefined') {
      const ok = window.confirm(t.chal_catalog_reset_confirm());
      if (!ok) return;
    }
    resetAll();
  };

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, close]);

  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-label={t.chal_drawer_aria()}
      aria-hidden={!isOpen}
      className={`fixed right-0 top-14 bottom-0 w-full sm:w-[380px] lg:w-[420px] xl:w-[460px] bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 shadow-xl transform transition-transform duration-300 z-30 flex flex-col ${
        isOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'
      }`}
    >
      {view === 'catalog' && (
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2 min-w-0">
            <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
              {t.chal_drawer_header()}
            </h2>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {hasAnyProgress && (
              <button
                type="button"
                onClick={handleResetAll}
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-gray-500 dark:text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                title={t.chal_catalog_reset_title()}
              >
                <RotateCcw className="w-3 h-3" />
                {t.chal_catalog_reset_btn()}
              </button>
            )}
            <button
              type="button"
              onClick={close}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              aria-label={t.chal_drawer_close()}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-hidden">
        {view === 'catalog' && (
          <div className="h-full overflow-y-auto custom-scrollbar">
            <ChallengeCatalog />
          </div>
        )}
        {view === 'challenge' && <ChallengeRunner />}
      </div>
    </aside>
  );
}
