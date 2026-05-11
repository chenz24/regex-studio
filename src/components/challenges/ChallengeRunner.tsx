import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, ChevronRight, Lightbulb, Link2, Sparkles, Trophy, X } from 'lucide-react';
import { useChallengeStore } from '@/stores/challengeStore';
import { useRegexStore } from '@/stores/regexStore';
import { findChallenge, CHALLENGES } from '@/challenges/data';
import { evaluateChallenge } from '@/challenges/evaluator';
import { MarkdownLite } from '../tutorial/MarkdownLite';
import { useT } from '@/lib/i18n';

export function ChallengeRunner() {
  const t = useT();
  const id = useChallengeStore((s) => s.currentChallengeId);
  const exitChallenge = useChallengeStore((s) => s.exitChallenge);
  const markSolved = useChallengeStore((s) => s.markSolved);
  const completion = useChallengeStore((s) => s.completion);
  const solutionRevealed = useChallengeStore((s) => s.solutionRevealed);
  const reveal = useChallengeStore((s) => s.revealSolution);
  const startChallenge = useChallengeStore((s) => s.startChallenge);

  const pattern = useRegexStore((s) => s.pattern);
  const flags = useRegexStore((s) => s.flags);
  const loadPattern = useRegexStore((s) => s.loadPattern);

  const challenge = id ? findChallenge(id) : undefined;

  const flagString = useMemo(
    () =>
      flags
        .filter((f) => f.enabled)
        .map((f) => f.key)
        .join(''),
    [flags],
  );

  const evaluation = useMemo(() => {
    if (!challenge) return null;
    return evaluateChallenge(challenge, pattern, flagString);
  }, [challenge, pattern, flagString]);

  // Auto-mark solved the moment evaluation flips to solved.
  useEffect(() => {
    if (evaluation?.solved) markSolved();
  }, [evaluation?.solved, markSolved]);

  const headingRef = useRef<HTMLHeadingElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: focus on challenge change
  useEffect(() => {
    headingRef.current?.focus();
  }, [id]);

  // Find next unsolved challenge in catalog order, for the "next" CTA.
  const nextChallenge = useMemo(() => {
    if (!challenge) return undefined;
    const idx = CHALLENGES.findIndex((c) => c.id === challenge.id);
    for (let i = idx + 1; i < CHALLENGES.length; i++) {
      if (!completion[CHALLENGES[i].id]) return CHALLENGES[i];
    }
    return undefined;
  }, [challenge, completion]);

  const [shareCopied, setShareCopied] = useState(false);
  const handleShare = async () => {
    if (!challenge || typeof window === 'undefined') return;
    const url = `${window.location.origin}${window.location.pathname}?challenge=${encodeURIComponent(challenge.id)}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.history.replaceState(null, '', url);
    }
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 1500);
  };

  if (!challenge || !evaluation) return null;

  const solved = evaluation.solved;
  const isRevealed = !!solutionRevealed[challenge.id];
  const hints = challenge.hints ?? [];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <button
          type="button"
          onClick={() => exitChallenge(true)}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"
          aria-label={t.chal_runner_back()}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] text-gray-400">{t.chal_runner_label()}</div>
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {challenge.title}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 custom-scrollbar">
        <h3
          ref={headingRef}
          tabIndex={-1}
          className="text-base font-semibold text-gray-900 dark:text-gray-100 outline-none"
        >
          {challenge.title}
        </h3>

        <MarkdownLite source={challenge.description} />

        {/* Status */}
        <div
          className={`rounded-lg border p-3 ${
            solved
              ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
              : evaluation.invalid
                ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800'
                : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'
          }`}
        >
          <div className="flex items-center justify-between gap-2 text-sm">
            <span
              className={`font-medium ${
                solved
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : evaluation.invalid
                    ? 'text-rose-700 dark:text-rose-300'
                    : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              {solved
                ? t.chal_runner_passed_all()
                : evaluation.invalid
                  ? t.chal_runner_invalid()
                  : t.chal_runner_progress({ passed: String(evaluation.passed), total: String(evaluation.total) })}
            </span>
            {!solved && pattern && !evaluation.invalid && (
              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                {t.chal_runner_keep_going()}
              </span>
            )}
          </div>
          {evaluation.invalidError && (
            <div className="mt-1 text-xs text-rose-600 dark:text-rose-400 font-mono">
              {evaluation.invalidError}
            </div>
          )}
        </div>

        {/* Per-case results */}
        <div className="space-y-1.5">
          {evaluation.results.map((r) => (
            <div
              key={r.index}
              className="flex items-start gap-2 px-2.5 py-1.5 rounded border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900/40"
            >
              <span
                className={`flex items-center justify-center w-4 h-4 rounded-full flex-shrink-0 mt-0.5 ${
                  r.pass
                    ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                }`}
              >
                {r.pass ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {r.label}
                  </span>
                  <span
                    className={`text-[10px] px-1 py-0.5 rounded ${
                      r.expect === 'match'
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                    }`}
                  >
                    {r.expect === 'match' ? t.chal_runner_expect_match() : t.chal_runner_expect_no_match()}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-gray-500 dark:text-gray-400 truncate mt-0.5">
                  {r.input || <em className="not-italic text-gray-400">{t.chal_runner_empty_input()}</em>}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Hints */}
        {hints.length > 0 && !solved && (
          <details className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-900/10 p-3 group">
            <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium text-amber-800 dark:text-amber-200 list-none">
              <Lightbulb className="w-3.5 h-3.5" />
              {t.chal_runner_hints({ n: String(hints.length) })}
              <ChevronRight className="w-3 h-3 ml-auto transition-transform group-open:rotate-90" />
            </summary>
            <ul className="mt-2 pl-5 list-disc space-y-1 text-xs text-amber-900 dark:text-amber-100">
              {hints.map((h, i) => (
                <li key={i}>
                  <MarkdownLite source={h} />
                </li>
              ))}
            </ul>
          </details>
        )}

        {/* Reveal solution */}
        {challenge.idealSolution && !solved && (
          <div className="space-y-2">
            {!isRevealed ? (
              <button
                type="button"
                onClick={() => reveal(challenge.id)}
                className="w-full px-3 py-2 text-xs rounded-md border border-dashed border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-rose-300 dark:hover:border-rose-700 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
              >
                {t.chal_runner_show_solution()}
              </button>
            ) : (
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 p-3 space-y-2">
                <div className="text-xs text-gray-500 dark:text-gray-400">{t.chal_runner_solution_label()}</div>
                <pre className="text-xs font-mono text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-all">
                  /{challenge.idealSolution.pattern}/{challenge.idealSolution.flags ?? ''}
                </pre>
                {challenge.idealSolution.explanation && (
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    {challenge.idealSolution.explanation}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() =>
                    loadPattern(
                      challenge.idealSolution!.pattern,
                      challenge.idealSolution!.flags ?? flagString,
                    )
                  }
                  className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-900 transition-colors"
                >
                  {t.chal_runner_load_to_editor()}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Solved CTA */}
        {solved && (
          <div className="rounded-lg bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/30 dark:to-teal-900/30 border border-emerald-200 dark:border-emerald-800 p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-900 dark:text-emerald-100">
              <Sparkles className="w-4 h-4" />
              {t.chal_runner_solved()}
            </div>
            <pre className="text-xs font-mono text-gray-900 dark:text-gray-100 bg-white/60 dark:bg-black/20 rounded px-2 py-1 break-all whitespace-pre-wrap">
              /{pattern}/{flagString}
            </pre>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleShare}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-white dark:bg-gray-900 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/40 transition-colors"
              >
                {shareCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    {t.chal_runner_link_copied()}
                  </>
                ) : (
                  <>
                    <Link2 className="w-3.5 h-3.5" />
                    {t.chal_runner_copy_link()}
                  </>
                )}
              </button>
              {nextChallenge && (
                <button
                  type="button"
                  onClick={() => startChallenge(nextChallenge.id)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                >
                  <Trophy className="w-3.5 h-3.5" />
                  {t.chal_runner_next_challenge()}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
