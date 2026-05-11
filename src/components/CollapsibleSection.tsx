import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';

interface CollapsibleSectionProps {
  title: string;
  icon?: ReactNode;
  defaultOpen?: boolean;
  badge?: string | number;
  children: ReactNode;
}

export function CollapsibleSection({
  title,
  icon,
  defaultOpen = true,
  badge,
  children,
}: CollapsibleSectionProps) {
  return (
    <Collapsible
      defaultOpen={defaultOpen}
      className="rounded-xl border border-gray-200 dark:border-gray-700/80 bg-white dark:bg-gray-900/60 overflow-hidden shadow-sm group"
    >
      <CollapsibleTrigger className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
        {icon && <span className="text-gray-400 dark:text-gray-500">{icon}</span>}
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex-1">
          {title}
        </span>
        {badge !== undefined && (
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300">
            {badge}
          </span>
        )}
        <ChevronDown className="w-4 h-4 text-gray-400 transition-transform group-data-[state=closed]:-rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4">{children}</CollapsibleContent>
    </Collapsible>
  );
}
