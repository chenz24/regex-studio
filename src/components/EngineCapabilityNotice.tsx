import { Info } from 'lucide-react';
import { useT } from '@/lib/i18n';

export function EngineCapabilityNotice({
  debuggerOnly = false,
  reason,
}: {
  debuggerOnly?: boolean;
  reason?: string;
}) {
  const t = useT();
  return (
    <div className="flex items-start gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/60 p-4 text-sm text-gray-600 dark:text-gray-400">
      <Info className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p>{debuggerOnly ? t.pcre2_debugger_unavailable() : t.pcre2_visualization_unavailable()}</p>
        {reason && <p className="mt-1 font-mono text-xs break-words">{reason}</p>}
      </div>
    </div>
  );
}
