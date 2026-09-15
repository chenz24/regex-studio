import { useEffect, useMemo, useState } from 'react';
import type { ASTNode } from '../../types/regex';
import {
  matchInputKey,
  runMatch,
  type MatchInput,
  type MatchOutcome,
} from '../../utils/matchEngine';
import { pcre2DebugResult } from '../../utils/pcre2DebugResult';
import { useT } from '@/lib/i18n';
import { DebuggerPanel } from './DebuggerPanel';

export function Pcre2DebuggerPanel({
  ast,
  pattern,
  testText,
  flagString,
}: {
  ast: ASTNode;
  pattern: string;
  testText: string;
  flagString: string;
}) {
  const t = useT();
  const [attempt, setAttempt] = useState(0);
  const input = useMemo<MatchInput>(
    () => ({
      engine: 'pcre2',
      trace: true,
      pattern,
      text: testText,
      flags: flagString,
      replacement: '',
      testInputs: [],
    }),
    [pattern, testText, flagString],
  );
  const key = matchInputKey(input);
  const [entry, setEntry] = useState<{ key: string; attempt: number; outcome: MatchOutcome }>();
  useEffect(() => {
    if (!pattern) return;
    let cancelled = false;
    runMatch(input).then((outcome) => {
      if (!cancelled) setEntry({ key, attempt, outcome });
    });
    return () => {
      cancelled = true;
    };
  }, [input, key, attempt, pattern]);
  const outcome = entry?.key === key && entry.attempt === attempt ? entry.outcome : undefined;
  const result = useMemo(
    () =>
      outcome
        ? pcre2DebugResult(outcome, pattern, testText, {
            before: (item) => t.pcre2_trace_before({ item }),
            backtrack: (item) => t.pcre2_trace_backtrack({ item }),
            start: (position) => t.pcre2_trace_start({ position: String(position) }),
            end: t.pcre2_trace_end(),
            matched: (start, end) =>
              t.pcre2_trace_matched({ start: String(start), end: String(end) }),
            noMatch: t.pcre2_trace_no_match(),
            incomplete: t.pcre2_trace_incomplete(),
          })
        : undefined,
    [outcome, pattern, testText, t],
  );

  if (!pattern)
    return <p className="p-3 text-sm text-gray-500">{t.debugger_enter_pattern_hint()}</p>;
  if (!outcome || !result)
    return (
      <p role="status" className="p-3 text-sm text-gray-500">
        {t.pcre2_trace_pending()}
      </p>
    );
  const error =
    outcome.executionError ??
    (outcome.validation?.valid === false ? outcome.validation.error : undefined);
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 dark:text-gray-400">{t.pcre2_trace_notice()}</p>
      {(error || outcome.timedOut) && (
        <div role="alert" className="text-sm text-amber-700 dark:text-amber-300">
          {error ?? t.regex_input_timed_out()}
          {outcome.validation?.valid !== false && (
            <button className="ml-2 underline" onClick={() => setAttempt((n) => n + 1)}>
              {t.engine_retry()}
            </button>
          )}
        </div>
      )}
      {!error && (
        <DebuggerPanel
          ast={ast}
          pattern={pattern}
          testText={testText}
          flagString={flagString}
          result={result}
          truncationMessage={
            outcome.timedOut ? t.pcre2_trace_incomplete() : t.pcre2_trace_truncated()
          }
        />
      )}
    </div>
  );
}
