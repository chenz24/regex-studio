import { useState } from 'react';
import { FileCode, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import { PATTERN_LIBRARY, getCategories } from '../../utils/patternLibrary';
import { useT, type Messages } from '@/lib/i18n';

function resolve(t: Messages, key: string | undefined, fallback: string): string {
  if (!key) return fallback;
  const fn = (t as Record<string, unknown>)[key];
  if (typeof fn !== 'function') return fallback;
  return (fn as () => string)();
}

function categoryKeyFor(name: string): string | undefined {
  return PATTERN_LIBRARY.find((p) => p.category === name)?.categoryKey;
}

interface PatternLibraryProps {
  onSelect: (pattern: string, flags: string) => void;
}

export function PatternLibrary({ onSelect }: PatternLibraryProps) {
  const t = useT();
  const categories = getCategories();
  const [activeCategory, setActiveCategory] = useState<string>(categories[0]);

  const filtered = PATTERN_LIBRARY.filter((p) => p.category === activeCategory);

  return (
    <div className="space-y-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            {resolve(t, categoryKeyFor(activeCategory), activeCategory)}
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg min-w-[150px] p-1"
        >
          <DropdownMenuRadioGroup value={activeCategory} onValueChange={setActiveCategory}>
            {categories.map((cat) => (
              <DropdownMenuRadioItem
                key={cat}
                value={cat}
                className={`px-3 py-1.5 text-sm rounded-md cursor-pointer transition-colors ${
                  cat === activeCategory
                    ? 'text-teal-600 dark:text-teal-400 font-medium'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {resolve(t, categoryKeyFor(cat), cat)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="space-y-1.5">
        {filtered.map((p) => (
          <button
            key={p.name}
            onClick={() => onSelect(p.pattern, p.flags)}
            className="w-full text-left p-2.5 rounded-lg border border-gray-100 dark:border-gray-700 hover:border-teal-300 dark:hover:border-teal-600 hover:bg-teal-50/50 dark:hover:bg-teal-900/20 transition-all group"
          >
            <div className="flex items-center gap-2 mb-1">
              <FileCode className="w-3.5 h-3.5 text-gray-400 group-hover:text-teal-500 transition-colors" />
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{resolve(t, p.nameKey, p.name)}</span>
              {p.flags && (
                <span className="text-xs font-mono text-gray-400 dark:text-gray-500">
                  /{p.flags}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 pl-5.5">{resolve(t, p.descKey, p.description)}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
