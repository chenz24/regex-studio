import { useState } from 'react';
import { Check, X, Plus, Camera, Trash2, ArrowUpToLine, Pencil } from 'lucide-react';
import type { TestCase, TestCaseResult, TestExpectation } from '../../types/regex';
import { useT } from '@/lib/i18n';

interface TestCasesPanelProps {
  testCases: TestCase[];
  testResults: TestCaseResult[];
  currentTestText: string;
  onAdd: (init?: Partial<Omit<TestCase, 'id'>>) => void;
  onUpdate: (id: string, patch: Partial<Omit<TestCase, 'id'>>) => void;
  onRemove: (id: string) => void;
  onLoadIntoEditor: (input: string) => void;
}

export function TestCasesPanel({
  testCases,
  testResults,
  currentTestText,
  onAdd,
  onUpdate,
  onRemove,
  onLoadIntoEditor,
}: TestCasesPanelProps) {
  const t = useT();
  const resultMap = new Map(testResults.map((r) => [r.id, r]));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">
          {t.testcases_intro()}
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => onAdd({ input: currentTestText, expect: 'match' })}
            disabled={!currentTestText}
            title={t.testcases_snapshot_hint()}
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-teal-400 dark:hover:border-teal-500 hover:text-teal-600 dark:hover:text-teal-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Camera className="w-3 h-3" />
            {t.testcases_snapshot_btn()}
          </button>
          <button
            onClick={() => onAdd({ input: '', expect: 'match' })}
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md bg-teal-500 text-white hover:bg-teal-600 transition-colors"
          >
            <Plus className="w-3 h-3" />
            {t.testcases_add_btn()}
          </button>
        </div>
      </div>

      {testCases.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t.testcases_empty_title()}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {t.testcases_empty_hint()}
          </p>
        </div>
      ) : (
        <ul className="space-y-2 max-h-[520px] overflow-y-auto pr-1 custom-scrollbar">
          {testCases.map((tc) => (
            <TestCaseRow
              key={tc.id}
              tc={tc}
              result={resultMap.get(tc.id)}
              onUpdate={(patch) => onUpdate(tc.id, patch)}
              onRemove={() => onRemove(tc.id)}
              onLoadIntoEditor={() => onLoadIntoEditor(tc.input)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

interface TestCaseRowProps {
  tc: TestCase;
  result: TestCaseResult | undefined;
  onUpdate: (patch: Partial<Omit<TestCase, 'id'>>) => void;
  onRemove: () => void;
  onLoadIntoEditor: () => void;
}

function TestCaseRow({ tc, result, onUpdate, onRemove, onLoadIntoEditor }: TestCaseRowProps) {
  const t = useT();
  const [editingLabel, setEditingLabel] = useState(false);
  const [editingInput, setEditingInput] = useState(false);

  const status = result?.invalid ? 'invalid' : result?.pass ? 'pass' : 'fail';

  const statusStyles: Record<string, string> = {
    pass: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300',
    fail: 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800 text-red-700 dark:text-red-300',
    invalid:
      'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300',
  };

  const StatusIcon = status === 'pass' ? Check : status === 'fail' ? X : Pencil;

  const expectOptions: { value: TestExpectation; label: string }[] = [
    { value: 'match', label: t.testcases_expect_match() },
    { value: 'noMatch', label: t.testcases_expect_no_match() },
  ];

  return (
    <li className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-700/60 bg-gray-50/60 dark:bg-gray-800/60">
        <span
          title={
            status === 'invalid'
              ? t.testcases_status_invalid_hint()
              : status === 'pass'
                ? t.testcases_status_pass()
                : t.testcases_status_fail()
          }
          className={`flex items-center justify-center w-5 h-5 rounded-full border ${statusStyles[status]}`}
        >
          <StatusIcon className="w-3 h-3" strokeWidth={3} />
        </span>

        {editingLabel ? (
          <input
            autoFocus
            value={tc.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            onBlur={() => setEditingLabel(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') {
                e.currentTarget.blur();
              }
            }}
            className="flex-1 min-w-0 text-xs font-semibold bg-transparent text-gray-800 dark:text-gray-200 border-b border-teal-400 outline-none px-0.5"
          />
        ) : (
          <button
            onClick={() => setEditingLabel(true)}
            className="flex-1 min-w-0 text-left text-xs font-semibold text-gray-800 dark:text-gray-200 truncate hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
          >
            {tc.label || <span className="italic text-gray-400">{t.testcases_untitled()}</span>}
          </button>
        )}

        <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500">
          {result?.invalid
            ? t.testcases_invalid_dash()
            : (result?.matchCount ?? 0) === 1
              ? t.testcases_match_count_one({ count: String(result?.matchCount ?? 0) })
              : t.testcases_match_count_other({ count: String(result?.matchCount ?? 0) })}
        </span>
      </div>

      <div className="p-3 space-y-2">
        <div className="flex items-center gap-1 p-0.5 bg-gray-100 dark:bg-gray-800 rounded-md w-fit">
          {expectOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onUpdate({ expect: opt.value })}
              className={`px-2 py-0.5 text-[11px] font-medium rounded transition-colors ${
                tc.expect === opt.value
                  ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {editingInput ? (
          <textarea
            autoFocus
            value={tc.input}
            onChange={(e) => onUpdate({ input: e.target.value })}
            onBlur={() => setEditingInput(false)}
            rows={Math.min(6, Math.max(2, tc.input.split('\n').length))}
            className="w-full text-xs font-mono px-2 py-1.5 rounded-md border border-teal-400 dark:border-teal-500 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 outline-none resize-y"
          />
        ) : (
          <button
            onClick={() => setEditingInput(true)}
            className="block w-full text-left text-xs font-mono px-2 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 transition-colors whitespace-pre-wrap break-all max-h-32 overflow-auto"
          >
            {tc.input || <span className="italic text-gray-400">{t.testcases_empty_input()}</span>}
          </button>
        )}

        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={onLoadIntoEditor}
            title={t.testcases_use_as_test_string_hint()}
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowUpToLine className="w-3 h-3" />
            {t.testcases_use_as_test_string()}
          </button>
          <button
            onClick={onRemove}
            title={t.testcases_delete_hint()}
            className="p-1 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </li>
  );
}
