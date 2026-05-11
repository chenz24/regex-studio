import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import type { ASTNode } from '../../types/regex';
import type { DebugStep, DebugResult } from '../../utils/steppingMatcher';
import { debugRegex } from '../../utils/steppingMatcher';
import { findNodeById } from '../../lib/ast';
import { useT } from '@/lib/i18n';

interface DebuggerPanelProps {
  ast: ASTNode;
  pattern: string;
  testText: string;
  flagString: string;
}

// ─── Step Colors ──────────────────────────────────────────────────────

const ACTION_STYLES: Record<string, { color: string; bg: string; icon: string }> = {
  try: { color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/5', icon: '→' },
  match: { color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/5', icon: '✓' },
  fail: { color: 'text-red-500 dark:text-red-400', bg: 'bg-red-500/5', icon: '✗' },
  backtrack: { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/5', icon: '↩' },
  'enter-group': {
    color: 'text-violet-600 dark:text-violet-400',
    bg: 'bg-violet-500/5',
    icon: '▶',
  },
  'exit-group': { color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-500/5', icon: '◀' },
};

// ─── Component ────────────────────────────────────────────────────────

export function DebuggerPanel({ ast, pattern, testText, flagString }: DebuggerPanelProps) {
  const t = useT();
  const [currentStep, setCurrentStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(300);
  const stepListRef = useRef<HTMLDivElement>(null);
  const playingRef = useRef(false);

  // Run the debugger
  const debugResult: DebugResult = useMemo(() => {
    if (!pattern || !testText) {
      return { steps: [], matched: false, totalSteps: 0, truncated: false };
    }
    return debugRegex(ast, testText, flagString);
  }, [ast, testText, flagString, pattern]);

  const { steps } = debugResult;
  const totalSteps = steps.length;
  const step: DebugStep | null = totalSteps > 0 ? (steps[currentStep] ?? null) : null;

  // Reset step when inputs change
  useEffect(() => {
    setCurrentStep(0);
    setPlaying(false);
    playingRef.current = false;
  }, []);

  // Auto-play
  useEffect(() => {
    playingRef.current = playing;
    if (!playing || totalSteps === 0) return;

    const timer = setInterval(() => {
      if (!playingRef.current) return;
      setCurrentStep((prev) => {
        if (prev >= totalSteps - 1) {
          setPlaying(false);
          playingRef.current = false;
          return prev;
        }
        return prev + 1;
      });
    }, speed);

    return () => clearInterval(timer);
  }, [playing, speed, totalSteps]);

  // Auto-scroll step log
  useEffect(() => {
    if (!stepListRef.current) return;
    const container = stepListRef.current;
    const activeEl = container.querySelector(`[data-step="${currentStep}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [currentStep]);

  const goFirst = useCallback(() => {
    setCurrentStep(0);
    setPlaying(false);
  }, []);
  const goPrev = useCallback(() => setCurrentStep((p) => Math.max(0, p - 1)), []);
  const goNext = useCallback(
    () => setCurrentStep((p) => Math.min(totalSteps - 1, p + 1)),
    [totalSteps],
  );
  const goLast = useCallback(() => {
    setCurrentStep(totalSteps - 1);
    setPlaying(false);
  }, [totalSteps]);
  const togglePlay = useCallback(() => {
    if (currentStep >= totalSteps - 1) {
      setCurrentStep(0);
      setPlaying(true);
    } else {
      setPlaying((p) => !p);
    }
  }, [currentStep, totalSteps]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      }
      if (e.key === ' ') {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goPrev, goNext, togglePlay]);

  if (!pattern || !testText) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500 text-sm gap-2">
        <span>{t.debugger_enter_pattern_hint()}</span>
      </div>
    );
  }

  if (totalSteps === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500 text-sm gap-2">
        <span>{t.debugger_no_steps()}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 max-w-3xl mx-auto">
      {/* Pattern Display */}
      <PatternDisplay pattern={pattern} step={step} ast={ast} />

      {/* String Display */}
      <StringDisplay text={testText} step={step} />

      {/* Controls */}
      <div className="flex items-center gap-2 px-1">
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <ControlButton onClick={goFirst} title={t.debugger_first_step()}>
            <SkipBack className="w-3.5 h-3.5" />
          </ControlButton>
          <ControlButton onClick={goPrev} title={t.debugger_prev_step()}>
            <ChevronLeft className="w-3.5 h-3.5" />
          </ControlButton>
          <ControlButton onClick={togglePlay} title={t.debugger_play_pause()} highlight>
            {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
          </ControlButton>
          <ControlButton onClick={goNext} title={t.debugger_next_step()}>
            <ChevronRight className="w-3.5 h-3.5" />
          </ControlButton>
          <ControlButton onClick={goLast} title={t.debugger_last_step()}>
            <SkipForward className="w-3.5 h-3.5" />
          </ControlButton>
        </div>

        <div className="flex items-center gap-2 flex-1">
          <span className="text-xs font-mono text-gray-500 dark:text-gray-400 tabular-nums whitespace-nowrap">
            {currentStep + 1} / {totalSteps}
          </span>
          <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-teal-500 rounded-full transition-all duration-100"
              style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            {t.debugger_speed_label()}
          </span>
          <input
            type="range"
            min={50}
            max={1000}
            step={50}
            value={1050 - speed}
            onChange={(e) => setSpeed(1050 - Number(e.target.value))}
            className="w-16 h-1 accent-teal-500"
            title={t.debugger_speed_tooltip({ ms: String(speed) })}
          />
        </div>
      </div>

      {/* Truncation warning */}
      {debugResult.truncated && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/50 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {t.debugger_truncated_warning()}
        </div>
      )}

      {/* Current step info */}
      {step && <StepInfo step={step} />}

      {/* Step Log */}
      <div
        ref={stepListRef}
        className="max-h-52 overflow-y-auto custom-scrollbar border border-gray-200 dark:border-gray-700/80 rounded-lg bg-gray-50/50 dark:bg-gray-800/30"
      >
        {steps.map((s, idx) => {
          const style = ACTION_STYLES[s.action] || ACTION_STYLES.try;
          const isCurrent = idx === currentStep;
          const isPast = idx < currentStep;
          return (
            <button
              key={s.id}
              data-step={idx}
              onClick={() => {
                setCurrentStep(idx);
                setPlaying(false);
              }}
              className={`w-full text-left flex items-start gap-2 px-3 py-1.5 text-xs font-mono border-b border-gray-100 dark:border-gray-800/60 transition-colors cursor-pointer ${
                isCurrent
                  ? `${style.bg} ring-1 ring-inset ring-teal-400/40 dark:ring-teal-500/40`
                  : isPast
                    ? 'opacity-50 hover:opacity-80'
                    : 'opacity-40 hover:opacity-60'
              }`}
            >
              <span className={`${style.color} font-bold shrink-0 w-4 text-center`}>
                {style.icon}
              </span>
              <span
                className={`flex-1 ${isCurrent ? 'text-gray-800 dark:text-gray-200' : 'text-gray-600 dark:text-gray-400'}`}
                style={{ paddingLeft: `${s.depth * 12}px` }}
              >
                {s.description}
              </span>
              <span className="text-gray-400 dark:text-gray-500 shrink-0 tabular-nums">
                @{s.stringPos}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────

function ControlButton({
  onClick,
  title,
  highlight,
  children,
}: {
  onClick: () => void;
  title: string;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${
        highlight
          ? 'bg-teal-500 text-white hover:bg-teal-600 shadow-sm'
          : 'text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 hover:shadow-sm'
      }`}
    >
      {children}
    </button>
  );
}

function PatternDisplay({
  pattern,
  step,
  ast,
}: {
  pattern: string;
  step: DebugStep | null;
  ast: ASTNode;
}) {
  const t = useT();
  // Find the AST node's source range for highlighting
  const highlightRange = useMemo(() => {
    if (!step) return null;
    const node = findNodeById(ast, step.astNodeId);
    if (!node) return null;
    return { start: node.start, end: node.end };
  }, [step, ast]);

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700/80 bg-white dark:bg-gray-900/60 overflow-hidden">
      <div className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-800/60 flex items-center gap-2">
        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
          {t.debugger_pattern_label()}
        </span>
      </div>
      <div className="px-3 py-2 font-mono text-sm overflow-x-auto custom-scrollbar whitespace-pre">
        {pattern.split('').map((ch, i) => {
          const highlighted = highlightRange && i >= highlightRange.start && i < highlightRange.end;
          return (
            <span
              key={i}
              className={
                highlighted
                  ? 'bg-teal-200 dark:bg-teal-800/60 text-teal-800 dark:text-teal-200 rounded-sm'
                  : 'text-gray-700 dark:text-gray-300'
              }
            >
              {ch}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function StringDisplay({ text, step }: { text: string; step: DebugStep | null }) {
  const t = useT();
  const pos = step?.stringPos ?? -1;
  const end = step?.stringEnd ?? -1;
  const hasRange = step && end > pos;

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700/80 bg-white dark:bg-gray-900/60 overflow-hidden">
      <div className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-800/60 flex items-center gap-2">
        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
          {t.debugger_test_string_label()}
        </span>
        {step && (
          <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500">{t.debugger_pos({ pos: String(pos) })}</span>
        )}
      </div>
      <div className="px-3 py-2 font-mono text-sm overflow-x-auto custom-scrollbar whitespace-pre relative">
        {text.split('').map((ch, i) => {
          const isCursor = i === pos;
          const isInRange = hasRange && i >= pos && i < end;
          const display = ch === '\n' ? '↵\n' : ch === '\t' ? '→\t' : ch;

          return (
            <span
              key={i}
              className={
                isInRange
                  ? 'bg-emerald-200 dark:bg-emerald-800/50 text-emerald-800 dark:text-emerald-200 rounded-sm'
                  : isCursor
                    ? 'bg-teal-200 dark:bg-teal-800/60 text-teal-800 dark:text-teal-200 rounded-sm'
                    : 'text-gray-700 dark:text-gray-300'
              }
            >
              {display}
            </span>
          );
        })}
        {/* Cursor at end of string */}
        {pos === text.length && (
          <span className="inline-block w-0.5 h-4 bg-teal-500 animate-pulse align-middle ml-px" />
        )}
      </div>
    </div>
  );
}

function StepInfo({ step }: { step: DebugStep }) {
  const style = ACTION_STYLES[step.action] || ACTION_STYLES.try;
  const groupEntries = Object.entries(step.captureGroups).filter(([, v]) => v !== null);

  return (
    <div
      className={`rounded-lg border border-gray-200 dark:border-gray-700/80 ${style.bg} overflow-hidden`}
    >
      <div className="px-3 py-2 flex items-start gap-2">
        <span className={`${style.color} font-bold font-mono text-sm mt-px`}>{style.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-800 dark:text-gray-200 font-medium">{step.description}</p>
          {groupEntries.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {groupEntries.map(([idx, val]) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-[10px] font-mono"
                >
                  <span className="font-bold">#{idx}</span>
                  <span className="text-violet-500 dark:text-violet-400">=</span>
                  <span>"{val!.value}"</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
