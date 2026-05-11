import { Check, X } from 'lucide-react';
import type { ValidationResult } from '@/tutorial/types';
import { useT } from '@/lib/i18n';

export function GoalCard({ result }: { result: ValidationResult | null }) {
  const t = useT();
  if (!result || result.checks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-3 text-xs text-gray-500 dark:text-gray-400">
        {t.tut_goal_empty()}
      </div>
    );
  }
  return (
    <div
      className={`rounded-lg border p-3 transition-colors ${
        result.pass
          ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-700'
          : 'border-gray-200 bg-gray-50 dark:bg-gray-800/40 dark:border-gray-700'
      }`}
    >
      <ul className="space-y-1.5">
        {result.checks.map((c, i) => (
          <li key={i} className="flex items-start gap-2 text-xs">
            <span
              className={`mt-0.5 inline-flex w-4 h-4 items-center justify-center rounded-full ${
                c.pass
                  ? 'bg-emerald-500 text-white'
                  : 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}
            >
              {c.pass ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
            </span>
            <div className="flex-1">
              <div
                className={
                  c.pass
                    ? 'text-emerald-800 dark:text-emerald-200'
                    : 'text-gray-700 dark:text-gray-300'
                }
              >
                <InlineMd text={c.label} />
              </div>
              {c.detail && (
                <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                  <InlineMd text={c.detail} />
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
      {result.feedback && !result.pass && (
        <div className="mt-2 text-xs text-amber-700 dark:text-amber-300 border-t border-gray-200 dark:border-gray-700 pt-2">
          {result.feedback}
        </div>
      )}
    </div>
  );
}

function InlineMd({ text }: { text: string }) {
  // Render `code` spans only — labels are short.
  const parts = text.split(/(`[^`]+`)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('`') && p.endsWith('`') ? (
          <code
            key={i}
            className="px-1 rounded bg-white/70 dark:bg-gray-900/50 font-mono text-[0.9em]"
          >
            {p.slice(1, -1)}
          </code>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}
