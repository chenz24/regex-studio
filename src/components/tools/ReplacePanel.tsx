import { ArrowRightLeft, Copy, Check, Sparkles, HelpCircle } from 'lucide-react';
import { useRef, useState } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
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
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(replacedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const insertToken = (token: string) => {
    const el = inputRef.current;
    const start = el?.selectionStart ?? replacement.length;
    const end = el?.selectionEnd ?? replacement.length;
    const next = replacement.slice(0, start) + token + replacement.slice(end);
    onReplacementChange(next);
    requestAnimationFrame(() => {
      el?.focus();
      const caret = start + token.length;
      el?.setSelectionRange(caret, caret);
    });
  };

  const tokens = [
    { token: '$1', insert: '$1', desc: t.replace_help_numbered() },
    { token: '$<name>', insert: '$<name>', desc: t.replace_help_named() },
    { token: '$&', insert: '$&', desc: t.replace_help_amp() },
    { token: '$`', insert: '$`', desc: t.replace_help_backtick() },
    { token: "$'", insert: "$'", desc: t.replace_help_quote() },
    { token: '$$', insert: '$$', desc: t.replace_help_dollar() },
  ];

  const showResult = replacement.length > 0 && matchCount > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
        <span>{t.replace_intro()}</span>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1 text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
              aria-label={t.replace_help_button()}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>{t.replace_help_button()}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="bottom"
            align="end"
            sideOffset={6}
            className="w-80 p-4 text-xs leading-relaxed text-gray-700 dark:text-gray-300"
          >
            <div className="font-semibold text-sm text-gray-900 dark:text-gray-100 mb-2">
              {t.replace_help_popover_title()}
            </div>
            <p className="mb-3 text-gray-600 dark:text-gray-400">
              {t.replace_help_popover_body()}
            </p>
            <div className="font-semibold text-gray-800 dark:text-gray-200 mb-1.5">
              {t.replace_help_popover_example_label()}
            </div>
            <div className="space-y-1 mb-3 p-2.5 rounded-md bg-gray-50 dark:bg-gray-800/60 font-mono">
              <div>
                <span className="text-gray-400 dark:text-gray-500 mr-2">{t.replace_help_popover_example_pattern()}</span>
                <code>(\w+)@(\w+)</code>
              </div>
              <div>
                <span className="text-gray-400 dark:text-gray-500 mr-2">{t.replace_help_popover_example_text()}</span>
                <code>alice@gmail</code>
              </div>
              <div>
                <span className="text-gray-400 dark:text-gray-500 mr-2">{t.replace_help_popover_example_replacement()}</span>
                <code className="text-teal-600 dark:text-teal-400">$2/$1</code>
              </div>
              <div>
                <span className="text-gray-400 dark:text-gray-500 mr-2">{t.replace_help_popover_example_result()}</span>
                <code>gmail/alice</code>
              </div>
            </div>
            <div className="font-semibold text-gray-800 dark:text-gray-200 mb-1.5">
              {t.replace_help_popover_tokens_label()}
            </div>
            <ul className="space-y-1">
              {tokens.map((row) => (
                <li key={row.token} className="flex items-baseline gap-2">
                  <code className="font-mono text-teal-600 dark:text-teal-400 shrink-0 min-w-[3.5rem]">
                    {row.token}
                  </code>
                  <span className="text-gray-600 dark:text-gray-400">{row.desc}</span>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          <ArrowRightLeft className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={replacement}
            onChange={(e) => onReplacementChange(e.target.value)}
            placeholder={t.replace_placeholder()}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 font-mono text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-teal-400 dark:focus:border-teal-500 transition-colors placeholder-gray-400"
            spellCheck={false}
          />
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40 px-3 py-2.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
          <Sparkles className="w-3 h-3" />
          <span>{t.replace_help_title()}</span>
          <span className="ml-auto normal-case font-normal tracking-normal text-[11px] text-gray-400 dark:text-gray-500">
            {t.replace_help_hint()}
          </span>
        </div>
        <TooltipProvider delayDuration={200}>
          <div className="flex flex-wrap gap-1.5">
            {tokens.map((row) => (
              <Tooltip key={row.token}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => insertToken(row.insert)}
                    className="px-2 py-0.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/60 hover:border-teal-400 dark:hover:border-teal-500 hover:bg-teal-50/60 dark:hover:bg-teal-900/20 font-mono text-[11px] text-teal-600 dark:text-teal-400 transition-colors"
                  >
                    {row.token}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={6}>
                  {row.desc}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </TooltipProvider>
      </div>

      {showResult ? (
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
      ) : (
        <div className="p-3 rounded-lg border border-dashed border-gray-200 dark:border-gray-700 text-xs text-gray-400 dark:text-gray-500 text-center">
          {matchCount === 0
            ? t.replace_empty_no_matches()
            : t.replace_empty_no_replacement()}
        </div>
      )}
    </div>
  );
}
