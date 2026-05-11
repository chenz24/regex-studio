import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, Wand2 } from 'lucide-react';
import { ENGINE_FLAVORS, type RegexEngine } from '@/types/engineTypes';
import { checkCompatibility } from '@/utils/compatibilityChecker';
import { useRegexStore, useRegexDerived } from '@/stores/regexStore';
import { MarkdownLite } from './MarkdownLite';

interface Props {
  flavors: RegexEngine[];
  commentary?: Partial<Record<RegexEngine, string>>;
}

/**
 * Inline widget that lets the user click through several flavors and see
 * how each treats the *current* pattern (compatibility warnings + optional
 * narrative commentary). The pattern is parsed once via the live AST in
 * the regex store, so warnings always reflect what the user is editing.
 */
export function FlavorCompareBlock({ flavors, commentary }: Props) {
  const ast = useRegexDerived().ast;
  const validation = useRegexDerived().validation;
  const currentEngine = useRegexStore((s) => s.engine);
  const setEngine = useRegexStore((s) => s.setEngine);

  const [active, setActive] = useState<RegexEngine>(() =>
    flavors.includes(currentEngine) ? currentEngine : flavors[0],
  );

  // Keep active in sync if the prop list narrows.
  useEffect(() => {
    if (!flavors.includes(active)) setActive(flavors[0]);
  }, [flavors, active]);

  const warnings = useMemo(() => {
    if (!validation.valid) return [];
    return checkCompatibility(ast, active);
  }, [ast, active, validation.valid]);

  return (
    <div className="rounded-lg border border-sky-200 dark:border-sky-800/60 bg-sky-50/40 dark:bg-sky-900/10 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-sky-200/70 dark:border-sky-800/40 bg-white/60 dark:bg-gray-900/30">
        <Wand2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
        <span className="text-xs font-semibold text-sky-900 dark:text-sky-200">
          Flavor 对比
        </span>
        <span className="text-[10px] text-gray-500 dark:text-gray-400 ml-auto">
          切换查看不同引擎对当前 pattern 的态度
        </span>
      </div>

      {/* Tabs */}
      <div role="tablist" className="flex items-center gap-1 px-2 pt-2 flex-wrap">
        {flavors.map((id) => {
          const flavor = ENGINE_FLAVORS[id];
          const selected = id === active;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(id)}
              className={`px-2 py-1 text-[11px] rounded-md font-medium transition-colors ${
                selected
                  ? 'bg-sky-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-sky-100 dark:hover:bg-sky-900/30'
              }`}
            >
              {flavor.shortName}
            </button>
          );
        })}
      </div>

      {/* Body */}
      <div className="p-3 space-y-2 text-xs">
        {!validation.valid ? (
          <div className="text-rose-600 dark:text-rose-400">
            当前 pattern 语法无效，无法做兼容性检查。
          </div>
        ) : warnings.length === 0 ? (
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" />
            在 <strong>{ENGINE_FLAVORS[active].name}</strong> 下没有兼容性问题。
          </div>
        ) : (
          <ul className="space-y-1.5">
            {warnings.map((w, i) => (
              <li
                key={i}
                className="flex items-start gap-2 px-2 py-1.5 rounded bg-white dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700/60"
              >
                <SeverityIcon severity={w.severity} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-gray-800 dark:text-gray-200">
                    {w.feature}
                    {w.raw && (
                      <span className="ml-1.5 font-mono text-[10px] text-gray-500 dark:text-gray-400">
                        {w.raw}
                      </span>
                    )}
                  </div>
                  <div className="text-gray-600 dark:text-gray-400 leading-relaxed">
                    {w.message}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {commentary?.[active] && (
          <div className="border-t border-sky-200/70 dark:border-sky-800/40 pt-2">
            <MarkdownLite source={commentary[active] ?? ''} />
          </div>
        )}

        {currentEngine !== active && (
          <button
            type="button"
            onClick={() => setEngine(active)}
            className="text-[11px] text-sky-700 dark:text-sky-300 hover:underline"
          >
            把主编辑器的 Flavor 切到 {ENGINE_FLAVORS[active].name} →
          </button>
        )}
      </div>
    </div>
  );
}

function SeverityIcon({ severity }: { severity: 'error' | 'warning' | 'info' }) {
  if (severity === 'error') return <AlertCircle className="w-3.5 h-3.5 text-rose-500 mt-0.5 flex-shrink-0" />;
  if (severity === 'warning') return <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />;
  return <Info className="w-3.5 h-3.5 text-sky-500 mt-0.5 flex-shrink-0" />;
}
