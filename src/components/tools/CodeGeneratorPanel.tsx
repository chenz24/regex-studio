import { useState, useMemo, useCallback } from 'react';
import { Check, Copy, ChevronDown, AlertTriangle, Code2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import {
  generateCode,
  LANGUAGE_CONFIGS,
  type CodeGenLanguage,
  type CodeGenOperation,
} from '../../utils/codegen';
import { useT, type Messages } from '@/lib/i18n';

const OP_LABEL_KEY: Record<CodeGenOperation, keyof Messages> = {
  test: 'codegen_op_test_label',
  match: 'codegen_op_match_label',
  matchAll: 'codegen_op_matchAll_label',
  capture: 'codegen_op_capture_label',
  replace: 'codegen_op_replace_label',
  split: 'codegen_op_split_label',
};

const OP_DESC_KEY: Record<CodeGenOperation, keyof Messages> = {
  test: 'codegen_op_test_desc',
  match: 'codegen_op_match_desc',
  matchAll: 'codegen_op_matchAll_desc',
  capture: 'codegen_op_capture_desc',
  replace: 'codegen_op_replace_desc',
  split: 'codegen_op_split_desc',
};

interface CodeGeneratorPanelProps {
  pattern: string;
  flags: string;
  testText: string;
  replacement: string;
}

const OPERATIONS: CodeGenOperation[] = ['test', 'match', 'matchAll', 'capture', 'replace', 'split'];

export function CodeGeneratorPanel({
  pattern,
  flags,
  testText,
  replacement,
}: CodeGeneratorPanelProps) {
  const t = useT();
  const [language, setLanguage] = useState<CodeGenLanguage>('javascript');
  const [operation, setOperation] = useState<CodeGenOperation>('matchAll');
  const [copied, setCopied] = useState(false);

  const result = useMemo(() => {
    if (!pattern) {
      return { code: t.codegen_empty_pattern_comment(), language: 'text', warnings: [] };
    }
    return generateCode({
      pattern,
      flags,
      testText: testText || 'Sample text to test against',
      replaceText: replacement || 'replacement',
      operation,
      language,
    });
  }, [pattern, flags, testText, replacement, operation, language, t]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(result.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [result.code]);

  const currentLangConfig = LANGUAGE_CONFIGS.find((c) => c.id === language);

  return (
    <div className="space-y-3">
      {/* Controls Row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Language Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
              <Code2 className="w-3.5 h-3.5 text-gray-500" />
              <span>{currentLangConfig?.name || language}</span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl max-h-64 overflow-y-auto custom-scrollbar p-1"
          >
            <DropdownMenuRadioGroup
              value={language}
              onValueChange={(val) => setLanguage(val as CodeGenLanguage)}
            >
              {LANGUAGE_CONFIGS.map((config) => (
                <DropdownMenuRadioItem
                  key={config.id}
                  value={config.id}
                  className={`px-3 py-2 text-sm flex items-center justify-between rounded-lg cursor-pointer transition-colors ${
                    config.id === language
                      ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {config.name}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Operation Tabs */}
        <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-x-auto">
          {OPERATIONS.map((op) => {
            const labelFn = t[OP_LABEL_KEY[op]] as unknown as () => string;
            const descFn = t[OP_DESC_KEY[op]] as unknown as () => string;
            return (
              <button
                key={op}
                onClick={() => setOperation(op)}
                title={descFn()}
                className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                  op === operation
                    ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {labelFn()}
              </button>
            );
          })}
        </div>
      </div>

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <div className="text-xs text-amber-700 dark:text-amber-300 space-y-1">
            {result.warnings.map((warning, i) => (
              <p key={i}>{warning}</p>
            ))}
          </div>
        </div>
      )}

      {/* Code Display */}
      <div className="relative group">
        <pre className="text-xs font-mono text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-800/60 p-4 rounded-lg border border-gray-200 dark:border-gray-700 overflow-auto custom-scrollbar leading-relaxed min-h-[200px] max-h-[400px]">
          <code>{result.code}</code>
        </pre>

        {/* Copy Button */}
        <button
          onClick={handleCopy}
          className={`absolute top-2 right-2 flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-all ${
            copied
              ? 'bg-teal-500 text-white'
              : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 opacity-0 group-hover:opacity-100 hover:bg-gray-50 dark:hover:bg-gray-600'
          }`}
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5" />
              {t.codegen_copied()}
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              {t.codegen_copy()}
            </>
          )}
        </button>
      </div>

      {/* Footer Hint */}
      <p className="text-[10px] text-gray-400 dark:text-gray-500">
        {t.codegen_footer_hint()}
      </p>
    </div>
  );
}
