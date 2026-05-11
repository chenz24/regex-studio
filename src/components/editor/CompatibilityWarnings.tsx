import { useState } from 'react';
import { AlertTriangle, Info, XCircle, ChevronDown } from 'lucide-react';
import type { CompatibilityWarning } from '../../types/engineTypes';
import { useT, type Messages } from '@/lib/i18n';

interface CompatibilityWarningsProps {
  warnings: CompatibilityWarning[];
  engineName: string;
}

const SEVERITY_CONFIG = {
  error: {
    icon: XCircle,
    bg: 'bg-red-50 dark:bg-red-900/15',
    border: 'border-red-200 dark:border-red-800/50',
    iconColor: 'text-red-500 dark:text-red-400',
    textColor: 'text-red-700 dark:text-red-300',
    badgeBg: 'bg-red-100 dark:bg-red-900/30',
    badgeText: 'text-red-600 dark:text-red-400',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-amber-50 dark:bg-amber-900/15',
    border: 'border-amber-200 dark:border-amber-800/50',
    iconColor: 'text-amber-500 dark:text-amber-400',
    textColor: 'text-amber-700 dark:text-amber-300',
    badgeBg: 'bg-amber-100 dark:bg-amber-900/30',
    badgeText: 'text-amber-600 dark:text-amber-400',
  },
  info: {
    icon: Info,
    bg: 'bg-blue-50 dark:bg-blue-900/15',
    border: 'border-blue-200 dark:border-blue-800/50',
    iconColor: 'text-blue-500 dark:text-blue-400',
    textColor: 'text-blue-700 dark:text-blue-300',
    badgeBg: 'bg-blue-100 dark:bg-blue-900/30',
    badgeText: 'text-blue-600 dark:text-blue-400',
  },
};

function resolve(t: Messages, key: string | undefined, fallback: string): string {
  if (!key) return fallback;
  const fn = (t as Record<string, unknown>)[key];
  if (typeof fn !== 'function') return fallback;
  return (fn as () => string)();
}

export function CompatibilityWarnings({ warnings, engineName }: CompatibilityWarningsProps) {
  const t = useT();
  const [expanded, setExpanded] = useState(true);

  if (warnings.length === 0) return null;

  // Use the highest severity for the container
  const highestSeverity = warnings.some((w) => w.severity === 'error')
    ? 'error'
    : warnings.some((w) => w.severity === 'warning')
      ? 'warning'
      : 'info';

  const config = SEVERITY_CONFIG[highestSeverity];
  const Icon = config.icon;

  return (
    <div
      className={`rounded-lg border ${config.border} ${config.bg} overflow-hidden transition-all`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
      >
        <Icon className={`w-3.5 h-3.5 shrink-0 ${config.iconColor}`} />
        <span className={`text-xs font-medium flex-1 ${config.textColor}`}>
          {warnings.length === 1
            ? t.compat_header_one({ count: String(warnings.length), engine: engineName })
            : t.compat_header_other({ count: String(warnings.length), engine: engineName })}
        </span>
        <ChevronDown
          className={`w-3 h-3 ${config.iconColor} transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="px-3 pb-2 space-y-1.5">
          {warnings.map((warning, i) => {
            const wConfig = SEVERITY_CONFIG[warning.severity];
            const WIcon = wConfig.icon;
            return (
              <div key={i} className="flex items-start gap-2 pl-1">
                <WIcon className={`w-3 h-3 mt-0.5 shrink-0 ${wConfig.iconColor}`} />
                <div className="flex-1 min-w-0">
                  <span className={`text-xs font-semibold ${wConfig.textColor}`}>
                    {resolve(t, warning.featureKey, warning.feature)}
                  </span>
                  {warning.raw && (
                    <code
                      className={`ml-1.5 text-[10px] font-mono px-1 py-0.5 rounded ${wConfig.badgeBg} ${wConfig.badgeText}`}
                    >
                      {warning.raw}
                    </code>
                  )}
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                    {resolve(t, warning.messageKey, warning.message)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
