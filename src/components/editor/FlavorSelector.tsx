import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import type { RegexEngine, ExecutionEngine } from '../../types/engineTypes';
import { ENGINE_FLAVORS, EXECUTION_ENGINES } from '../../types/engineTypes';
import { useT, type Messages } from '@/lib/i18n';

const ENGINE_NOTES_KEY: Record<RegexEngine, keyof Messages> = {
  javascript: 'engine_notes_javascript',
  python: 'engine_notes_python',
  pcre2: 'engine_notes_pcre2',
  java: 'engine_notes_java',
  go: 'engine_notes_go',
  dotnet: 'engine_notes_dotnet',
  rust: 'engine_notes_rust',
};

interface FlavorSelectorProps {
  engine: ExecutionEngine;
  onEngineChange: (engine: ExecutionEngine) => void;
}

export function FlavorSelector({ engine, onEngineChange }: FlavorSelectorProps) {
  const t = useT();
  const current = ENGINE_FLAVORS[engine];
  const noteFor = (id: RegexEngine) => {
    const fn = t[ENGINE_NOTES_KEY[id]] as unknown as () => string;
    return fn();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={t.execution_engine_select()}
          className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded border border-gray-200 dark:border-gray-700 font-mono hover:bg-gray-200 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
        >
          <span>
            {current.name} ({engine === 'javascript' ? t.engine_browser_native() : current.version})
          </span>
          <ChevronDown className="w-3 h-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-72 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl max-h-80 overflow-y-auto custom-scrollbar p-0"
      >
        <DropdownMenuLabel className="px-3 py-3 border-b border-gray-100 dark:border-gray-800">
          <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
            {t.execution_engine_select()}
          </div>
          <p className="mt-1 text-[11px] font-normal normal-case tracking-normal text-gray-500 dark:text-gray-400 leading-snug">
            {t.execution_engine_select_hint()}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={engine}
          onValueChange={(val) => onEngineChange(val as ExecutionEngine)}
        >
          <div className="py-1">
            {EXECUTION_ENGINES.map((id) => {
              const flavor = ENGINE_FLAVORS[id];
              const isActive = id === engine;
              return (
                <DropdownMenuRadioItem
                  key={id}
                  value={id}
                  className={`px-3 py-2 flex items-start gap-3 cursor-pointer transition-colors rounded-none focus:outline-none focus:ring-0 ${
                    isActive
                      ? 'bg-teal-50 dark:bg-teal-900/20'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-semibold ${
                          isActive
                            ? 'text-teal-700 dark:text-teal-300'
                            : 'text-gray-800 dark:text-gray-200'
                        }`}
                      >
                        {flavor.name}
                      </span>
                      <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500">
                        {id === 'javascript' ? t.engine_browser_native() : flavor.version}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                      {noteFor(flavor.id)}
                    </p>
                  </div>
                </DropdownMenuRadioItem>
              );
            })}
          </div>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
