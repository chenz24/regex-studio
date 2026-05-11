import { AlertTriangle } from 'lucide-react';
import type { MatchInfo } from '../../types/regex';
import { useT } from '@/lib/i18n';

interface MatchDetailsProps {
  matches: MatchInfo[];
  selectedMatch: number | null;
  onSelectMatch: (index: number | null) => void;
}

export function MatchDetails({ matches, selectedMatch, onSelectMatch }: MatchDetailsProps) {
  const t = useT();
  if (matches.length === 0) {
    return (
      <div className="text-center py-10">
        <div className="inline-block p-3 bg-gray-100 dark:bg-gray-800 rounded-full mb-3">
          <AlertTriangle className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{t.match_details_no_matches()}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
      {matches.map((match, i) => (
        <button
          key={i}
          onClick={() => onSelectMatch(selectedMatch === i ? null : i)}
          className={`w-full text-left rounded-xl border overflow-hidden transition-all ${
            selectedMatch === i
              ? 'border-teal-400 dark:border-teal-500 shadow-sm'
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
          }`}
        >
          <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                selectedMatch === i
                  ? 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}
            >
              {t.match_details_match_label({ n: String(i + 1) })}
            </span>
            <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400">
              {t.match_details_idx({ start: String(match.start) })}
            </span>
          </div>
          <div className="p-3 space-y-2.5">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-widest font-bold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {t.match_details_full_match()}
              </span>
              <span className="font-mono text-sm px-2.5 py-1.5 rounded-lg border break-all text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-900/15 border-emerald-200 dark:border-emerald-800">
                {match.match || (
                  <span className="text-gray-500 dark:text-gray-400 italic">{t.match_details_empty()}</span>
                )}
              </span>
            </div>

            {match.groups.map(
              (group) =>
                group.value !== undefined && (
                  <div key={group.index} className="flex flex-col gap-1">
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-widest font-bold flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                      {group.name || t.match_details_group_unnamed({ idx: String(group.index) })}
                    </span>
                    <span className="font-mono text-sm px-2.5 py-1.5 rounded-lg border break-all text-sky-800 dark:text-sky-200 bg-sky-50 dark:bg-sky-900/15 border-sky-200 dark:border-sky-800">
                      {group.value}
                    </span>
                  </div>
                ),
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
