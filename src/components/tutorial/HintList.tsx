import { useState } from 'react';
import { Lightbulb, KeyRound } from 'lucide-react';
import type { Step } from '@/tutorial/types';
import { useT } from '@/lib/i18n';

interface Props {
  step: Step;
  failCount: number;
  onRevealSolution: () => void;
}

export function HintList({ step, failCount, onRevealSolution }: Props) {
  const t = useT();
  const hints = step.hints ?? [];
  const [revealed, setRevealed] = useState<number>(0);
  const [solutionShown, setSolutionShown] = useState(false);

  const totalHints = hints.length;
  // Auto-unlock: every 2 failed attempts reveals one more hint.
  const autoUnlocked = Math.min(totalHints, Math.floor(failCount / 2));
  const visible = Math.max(revealed, autoUnlocked);
  const canRevealMore = visible < totalHints;
  const canRevealSolution = !!step.solution && (failCount >= 4 || solutionShown);

  if (totalHints === 0 && !step.solution) return null;

  return (
    <div className="space-y-2">
      {visible > 0 && (
        <ul className="space-y-1.5">
          {hints.slice(0, visible).map((h, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-xs rounded-md bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/40 px-2.5 py-1.5"
            >
              <Lightbulb className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <span className="text-amber-900 dark:text-amber-200">{h}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2">
        {canRevealMore && (
          <button
            type="button"
            onClick={() => setRevealed(visible + 1)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
          >
            <Lightbulb className="w-3.5 h-3.5" />
            {t.tut_hint_need({ current: String(visible + 1), total: String(totalHints) })}
          </button>
        )}
        {step.solution && (
          <button
            type="button"
            disabled={!canRevealSolution}
            onClick={() => {
              setSolutionShown(true);
              onRevealSolution();
            }}
            title={!canRevealSolution ? t.tut_hint_solution_locked() : undefined}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <KeyRound className="w-3.5 h-3.5" />
            {solutionShown ? t.tut_hint_solution_shown() : t.tut_hint_show_solution()}
          </button>
        )}
      </div>

      {solutionShown && step.solution && (
        <div className="rounded-md border border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-900/15 px-3 py-2 text-xs text-rose-900 dark:text-rose-200">
          <div className="font-mono mb-1">{step.solution.pattern}</div>
          {step.solution.explanation && (
            <div className="text-[11px] text-rose-700 dark:text-rose-300">
              {step.solution.explanation}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
