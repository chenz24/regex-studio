import { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { MatchInfo } from '../../types/regex';
import { useT } from '@/lib/i18n';

interface MatchDetailsProps {
  matches: MatchInfo[];
  matchesTruncated?: boolean;
  selectedMatch: number | null;
  selectedGroup?: number;
  resultsReady?: boolean;
  sourceAvailable?: boolean;
  ambiguous?: boolean;
  onSelectMatch: (index: number | null) => void;
  onSelectGroup?: (matchIndex: number, groupIndex: number) => void;
  onReveal?: (target: 'pattern' | 'text') => void;
}

export function MatchDetails({
  matches,
  matchesTruncated,
  selectedMatch,
  selectedGroup,
  resultsReady = true,
  sourceAvailable = true,
  ambiguous,
  onSelectMatch,
  onSelectGroup,
  onReveal,
}: MatchDetailsProps) {
  const t = useT();
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selectedMatch === null) return;
    const list = listRef.current;
    const row = list?.querySelector<HTMLElement>(`[data-match-index="${selectedMatch}"]`);
    if (!list || !row) return;
    // Scroll the list itself; inspecting text must not move the whole page.
    const relative = row.getBoundingClientRect().top - list.getBoundingClientRect().top;
    if (relative < 0 || relative + row.offsetHeight > list.clientHeight) list.scrollTop += relative;
  }, [selectedMatch]);

  if (!matches.length)
    return (
      <div className="text-center py-10">
        <AlertTriangle className="w-5 h-5 mx-auto mb-3 text-gray-400" />
        <p className="text-sm text-gray-500 dark:text-gray-400">{t.match_details_no_matches()}</p>
      </div>
    );

  return (
    <div className="space-y-3">
      {matchesTruncated && resultsReady && (
        <p role="status" className="text-xs text-amber-700 dark:text-amber-300">
          {t.matches_truncated_hint({ count: String(matches.length) })}
        </p>
      )}
      <p className="text-[11px] text-gray-500 dark:text-gray-400">
        {resultsReady ? t.inspection_match_hint() : t.inspection_pending()}
      </p>
      {selectedMatch !== null && (
        <div className="flex flex-wrap gap-2 text-xs">
          <button
            disabled={!sourceAvailable}
            onClick={() => onReveal?.('pattern')}
            className="underline text-violet-700 dark:text-violet-300 disabled:opacity-40"
          >
            {t.inspection_show_source()}
          </button>
          <button
            disabled={
              selectedGroup !== undefined &&
              matches[selectedMatch]?.groups.find((g) => g.index === selectedGroup)?.value ===
                undefined
            }
            onClick={() => onReveal?.('text')}
            className="underline text-violet-700 dark:text-violet-300 disabled:opacity-40"
          >
            {t.inspection_show_text()}
          </button>
          <button onClick={() => onSelectMatch(null)} className="underline text-gray-500">
            {t.inspection_clear()}
          </button>
        </div>
      )}
      {selectedGroup !== undefined && !sourceAvailable && (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          {t.inspection_source_unavailable()}
        </p>
      )}
      {ambiguous && (
        <p role="status" className="text-xs text-amber-700 dark:text-amber-300">
          {t.inspection_ambiguous()}
        </p>
      )}
      <div
        ref={listRef}
        className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar"
      >
        {matches.map((match, i) => (
          <div
            key={i}
            data-match-index={i}
            className={`rounded-xl border overflow-hidden ${selectedMatch === i ? 'border-violet-400 dark:border-violet-500' : 'border-gray-200 dark:border-gray-700'}`}
          >
            <div className="flex items-center justify-between gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800/60 text-xs text-gray-600 dark:text-gray-300">
              <span>{t.match_details_match_label({ n: String(i + 1) })}</span>
              <span className="font-mono">
                [{match.start}, {match.end})
              </span>
            </div>
            <div className="p-3 space-y-2">
              <button
                data-testid="inspect-match"
                disabled={!resultsReady}
                aria-pressed={selectedMatch === i && selectedGroup === undefined}
                onClick={() =>
                  onSelectMatch(selectedMatch === i && selectedGroup === undefined ? null : i)
                }
                className="block w-full text-left rounded-lg border border-emerald-200 dark:border-emerald-800 p-2 bg-emerald-50 dark:bg-emerald-900/15 text-emerald-800 dark:text-emerald-200 disabled:opacity-40 aria-pressed:ring-2 ring-violet-500"
              >
                <span className="block text-[10px] font-semibold mb-1">
                  {t.match_details_full_match()}
                </span>
                <span className="font-mono text-sm whitespace-pre-wrap break-all">
                  {match.match || t.match_details_empty()}
                </span>
              </button>
              {match.groups.map((group) => (
                <button
                  key={group.index}
                  data-testid="inspect-capture"
                  data-group-index={group.index}
                  disabled={!resultsReady || !onSelectGroup}
                  aria-pressed={selectedMatch === i && selectedGroup === group.index}
                  onClick={() => onSelectGroup?.(i, group.index)}
                  className="block w-full text-left rounded-lg border border-sky-200 dark:border-sky-800 p-2 bg-sky-50 dark:bg-sky-900/15 text-sky-800 dark:text-sky-200 disabled:opacity-40 aria-pressed:ring-2 ring-violet-500"
                >
                  <span className="flex flex-wrap justify-between gap-1 text-[10px] mb-1">
                    <span>
                      #{group.index}
                      {group.name ? ` · ${group.name}` : ''}
                    </span>
                    {group.start >= 0 && (
                      <span className="font-mono">
                        [{group.start}, {group.end})
                      </span>
                    )}
                  </span>
                  <span
                    data-testid="capture-value"
                    className="font-mono text-sm whitespace-pre-wrap break-all"
                  >
                    {group.value === undefined
                      ? t.inspection_unmatched()
                      : group.value === ''
                        ? t.match_details_empty()
                        : group.value}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
