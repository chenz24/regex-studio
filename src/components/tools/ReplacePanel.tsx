import { ArrowRightLeft, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { useT } from '@/lib/i18n';

interface ReplacePanelProps {
  replacement: string;
  onReplacementChange: (value: string) => void;
  replacedText: string;
  matchCount: number;
}

export function ReplacePanel({
  replacement,
  onReplacementChange,
  replacedText,
  matchCount,
}: ReplacePanelProps) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(replacedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          <ArrowRightLeft className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" />
          <input
            type="text"
            value={replacement}
            onChange={(e) => onReplacementChange(e.target.value)}
            placeholder={t.replace_placeholder()}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 font-mono text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-teal-400 dark:focus:border-teal-500 transition-colors placeholder-gray-400"
            spellCheck={false}
          />
        </div>
      </div>

      {replacement && (
        <div className="relative">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {matchCount === 1
                ? t.replace_result_label_one({ count: String(matchCount) })
                : t.replace_result_label_other({ count: String(matchCount) })}
            </span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? t.replace_copied() : t.replace_copy_result()}
            </button>
          </div>
          <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 font-mono text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto custom-scrollbar">
            {replacedText}
          </div>
        </div>
      )}
    </div>
  );
}
