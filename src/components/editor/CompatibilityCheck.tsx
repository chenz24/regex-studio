import { useId, useState } from 'react';
import { ChevronDown, Info, ScanSearch, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useT } from '@/lib/i18n';
import {
  COMPATIBILITY_TARGETS,
  ENGINE_FLAVORS,
  type CompatibilityTarget,
  type CompatibilityWarning,
  type ExecutionEngine,
} from '../../types/engineTypes';
import { CompatibilityWarnings } from './CompatibilityWarnings';

interface CompatibilityCheckProps {
  engine: ExecutionEngine;
  target: CompatibilityTarget | null;
  onTargetChange: (target: CompatibilityTarget | null) => void;
  warnings: CompatibilityWarning[];
  valid: boolean;
  hasPattern: boolean;
  legacyTargetFlags: string;
}

export function CompatibilityCheck({
  engine,
  target,
  onTargetChange,
  warnings,
  valid,
  hasPattern,
  legacyTargetFlags,
}: CompatibilityCheckProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const hintId = useId();
  const canCheck = engine === 'javascript' && valid && hasPattern;
  const targetName = target ? ENGINE_FLAVORS[target].name : '';
  const count = canCheck && target ? warnings.length : 0;
  const status = !canCheck
    ? t.compatibility_not_checked()
    : count > 0
      ? count === 1
        ? t.compatibility_notice_one()
        : t.compatibility_notice_count({ count: String(count) })
      : '';
  const hasError = canCheck && warnings.some((warning) => warning.severity === 'error');
  const hasWarning = canCheck && warnings.some((warning) => warning.severity === 'warning');
  const badgeClass = hasError
    ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
    : hasWarning
      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="compatibility-trigger"
          aria-label={`${t.compatibility_select()}${targetName ? `: ${targetName}${status ? ` · ${status}` : ''}` : ''}`}
          className="flex min-h-8 items-center gap-1.5 rounded-md px-2 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200 data-[state=open]:bg-gray-100 dark:data-[state=open]:bg-gray-800"
        >
          <ScanSearch className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{targetName || t.compatibility_check_action()}</span>
          {target && status && (
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${badgeClass}`}>
              {status}
            </span>
          )}
          <ChevronDown className="h-3 w-3 shrink-0" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        collisionPadding={16}
        aria-labelledby={titleId}
        aria-describedby={hintId}
        className="w-[360px] max-w-[calc(100vw-32px)] max-h-[var(--radix-popover-content-available-height)] overflow-y-auto rounded-xl p-4 shadow-xl custom-scrollbar"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            {t.compatibility_select()}
          </h2>
          <button
            type="button"
            aria-label={t.compatibility_close()}
            onClick={() => setOpen(false)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <p id={hintId} className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
          {t.compatibility_partial()}
        </p>
        <label className="mt-4 block text-xs font-medium text-gray-600 dark:text-gray-300">
          {t.compatibility_target_label()}
          <select
            value={target ?? ''}
            onChange={(event) =>
              onTargetChange((event.target.value || null) as CompatibilityTarget | null)
            }
            className="mt-2 min-h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          >
            <option value="">{t.compatibility_off()}</option>
            {COMPATIBILITY_TARGETS.map((id) => (
              <option key={id} value={id}>
                {ENGINE_FLAVORS[id].name} · {ENGINE_FLAVORS[id].version}
              </option>
            ))}
          </select>
        </label>
        {!canCheck && (
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-gray-50 p-3 text-xs leading-relaxed text-gray-600 dark:bg-gray-800/60 dark:text-gray-300">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {engine === 'pcre2'
              ? t.pcre2_compatibility_unavailable()
              : !valid
                ? t.compatibility_invalid()
                : t.compatibility_enter_pattern()}
          </p>
        )}
        {target && canCheck && (
          <div className="mt-3" aria-live="polite">
            {count > 0 ? (
              <CompatibilityWarnings warnings={warnings} engineName={targetName} />
            ) : (
              <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                {t.compatibility_no_known_issues()}
              </p>
            )}
          </div>
        )}
        {target && legacyTargetFlags && (
          <p className="mt-3 border-t border-gray-100 pt-3 text-xs leading-relaxed text-gray-500 dark:border-gray-800 dark:text-gray-400">
            {t.compatibility_legacy_flags({ flags: legacyTargetFlags, target: targetName })}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
