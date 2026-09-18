import { useEffect, useRef, useState } from 'react';
import { Check, X, Plus, Camera, Trash2, ArrowUpToLine, Pencil } from 'lucide-react';
import type {
  TestCase,
  TestCaseResult,
  TestExpectation,
  AssertionDifference,
  ExpectedCapture,
  TestExecution,
} from '../../types/regex';
import { useT } from '@/lib/i18n';
import { assertionsFromResult, canSnapshot, executionChanged } from '../../utils/testCaseGrader';
import { decodeTestSet, encodeTestSet, MAX_TEST_CASES } from '../../lib/testCases';
import { TestAssertionsEditor, useAssertionLabels } from './TestAssertionsEditor';

interface TestCasesPanelProps {
  testCases: TestCase[];
  testResults: TestCaseResult[];
  currentTestText: string;
  onAdd: (init?: Partial<Omit<TestCase, 'id'>>) => void;
  onUpdate: (id: string, patch: Partial<Omit<TestCase, 'id'>>) => void;
  onRemove: (id: string) => void;
  onLoadIntoEditor: (input: string) => void;
  onImport: (cases: TestCase[]) => void;
}

export function TestCasesPanel({
  testCases,
  testResults,
  currentTestText,
  onAdd,
  onUpdate,
  onRemove,
  onLoadIntoEditor,
  onImport,
}: TestCasesPanelProps) {
  const t = useT();
  const resultMap = new Map(testResults.map((r) => [r.id, r]));
  const [filter, setFilter] = useState('all');
  const [baseline, setBaseline] = useState<Map<string, TestExecution>>(() => new Map());
  const [importError, setImportError] = useState(false);
  const [imported, setImported] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setBaseline((previous) => {
      const next = new Map(previous);
      let changed = false;
      for (const result of testResults) {
        if (canSnapshot(result) && !next.has(result.id)) {
          next.set(result.id, result.actual!);
          changed = true;
        }
      }
      return changed ? next : previous;
    });
  }, [testResults]);
  const visible = testCases.filter((tc) => {
    const result = resultMap.get(tc.id);
    if (filter === 'failed') return result?.status === 'fail';
    if (filter === 'unsettled') return !result || result.status === 'inconclusive';
    if (filter === 'changed')
      return (
        canSnapshot(result) &&
        baseline.has(tc.id) &&
        executionChanged(baseline.get(tc.id)!, result!.actual!)
      );
    return true;
  });
  const exportCases = () => {
    const url = URL.createObjectURL(
      new Blob([encodeTestSet(testCases)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'regexstudio-tests.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex-1 min-w-[140px] text-[11px] text-gray-500 dark:text-gray-400 leading-snug">
          {t.testcases_intro()}
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => onAdd({ input: currentTestText, expect: 'match' })}
            disabled={testCases.length >= MAX_TEST_CASES}
            title={t.testcases_snapshot_hint()}
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-teal-400 dark:hover:border-teal-500 hover:text-teal-600 dark:hover:text-teal-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Camera className="w-3 h-3" />
            {t.testcases_snapshot_btn()}
          </button>
          <button
            onClick={() => onAdd({ input: '', expect: 'match' })}
            disabled={testCases.length >= MAX_TEST_CASES}
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md bg-teal-500 text-white hover:bg-teal-600 transition-colors"
          >
            <Plus className="w-3 h-3" />
            {t.testcases_add_btn()}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
        <select
          aria-label={t.testcases_filter()}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded border border-gray-200 dark:border-gray-700 bg-transparent p-1"
        >
          <option value="all">{t.testcases_filter_all()}</option>
          <option value="failed">{t.testcases_filter_failed()}</option>
          <option value="unsettled">{t.testcases_filter_unsettled()}</option>
          <option value="changed">{t.testcases_filter_changed()}</option>
        </select>
        {filter === 'changed' && (
          <button
            className="underline"
            onClick={() =>
              setBaseline(new Map(testResults.filter(canSnapshot).map((r) => [r.id, r.actual!])))
            }
          >
            {t.testcases_reset_baseline()}
          </button>
        )}
        <button
          onClick={exportCases}
          disabled={!testCases.length}
          className="underline disabled:opacity-40"
        >
          {t.testcases_export()}
        </button>
        <button onClick={() => importInput.current?.click()} className="underline">
          {t.testcases_import()}
        </button>
        <input
          ref={importInput}
          type="file"
          accept=".json,application/json"
          aria-label={t.testcases_import()}
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            setImportError(false);
            setImported(false);
            try {
              const cases = decodeTestSet(await file.text());
              if (!cases || cases.length + testCases.length > MAX_TEST_CASES)
                throw new Error('Invalid test set');
              onImport(cases);
              setImported(true);
              setFilter('all');
            } catch {
              setImportError(true);
            }
          }}
        />
      </div>
      <p className="text-[11px] text-gray-500 dark:text-gray-400">
        {filter === 'changed' ? t.testcases_baseline_hint() : t.testcases_import_hint()}
      </p>
      {importError && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {t.testcases_import_error()}
        </p>
      )}
      {imported && (
        <p role="status" className="text-xs text-teal-600 dark:text-teal-400">
          {t.testcases_imported()}
        </p>
      )}
      {testCases.length > 0 && !visible.length && (
        <p className="py-6 text-center text-xs text-gray-500">{t.testcases_filter_empty()}</p>
      )}
      {testCases.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t.testcases_empty_title()}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {t.testcases_empty_hint()}
          </p>
        </div>
      ) : (
        <ul className="space-y-2 max-h-[520px] overflow-y-auto pr-1 custom-scrollbar">
          {visible.map((tc) => (
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
  const labels = useAssertionLabels();
  // Wrapping every character of a large imported input can block layout,
  // especially in WebKit. Only the preview is shortened; tc.input stays intact.
  const inputTruncated = tc.input.length > 2_000;
  const inputPreview = inputTruncated
    ? `${tc.input.slice(0, 2_000).replace(/[\uD800-\uDBFF]$/, '')}…`
    : tc.input;

  const unsettled =
    !result ||
    result.status === 'inconclusive' ||
    result.pending ||
    result.timedOut ||
    result.executionError;
  const status = result?.invalid || unsettled ? 'invalid' : result?.pass ? 'pass' : 'fail';

  const statusStyles: Record<string, string> = {
    pass: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300',
    fail: 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800 text-red-700 dark:text-red-300',
    invalid:
      'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300',
  };

  const displayDifference = (field: AssertionDifference['field'], value: unknown) => {
    if (field === 'expect')
      return value === 'match' ? t.testcases_expect_match() : t.testcases_expect_no_match();
    if (field === 'captures')
      return (
        (value as ExpectedCapture[][])
          .flatMap((groups, i) =>
            groups.length
              ? groups.map(
                  (group) =>
                    `${t.testcases_match_number({ count: String(i + 1) })} · #${group.index}${group.name ? ` (${group.name})` : ''}: ${group.value === null ? t.testcases_capture_unset() : `${JSON.stringify(group.value)} [${group.start}, ${group.end})`}`,
                )
              : [`${t.testcases_match_number({ count: String(i + 1) })}: —`],
          )
          .join('\n') || '[]'
      );
    if (field === 'texts' || field === 'ranges')
      return (
        (value as unknown[]).map((item, i) => `${i + 1}. ${JSON.stringify(item)}`).join('\n') ||
        '[]'
      );
    return JSON.stringify(value);
  };

  const StatusIcon = status === 'pass' ? Check : status === 'fail' ? X : Pencil;

  const expectOptions: { value: TestExpectation; label: string }[] = [
    { value: 'match', label: t.testcases_expect_match() },
    { value: 'noMatch', label: t.testcases_expect_no_match() },
  ];

  return (
    <li
      data-testid="test-case"
      data-status={result?.status ?? 'inconclusive'}
      className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 overflow-hidden"
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-700/60 bg-gray-50/60 dark:bg-gray-800/60">
        <span
          title={
            result?.truncated
              ? t.testcases_truncated()
              : result?.replacementError
                ? t.testcases_replacement_error()
                : result?.executionError
                  ? t.engine_execution_failed()
                  : result?.pending
                    ? t.match_pending()
                    : result?.timedOut
                      ? t.match_timed_out()
                      : status === 'invalid'
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
          {result?.truncated
            ? t.testcases_truncated()
            : result?.replacementError
              ? t.testcases_replacement_error()
              : result?.executionError
                ? t.engine_execution_failed()
                : result?.pending
                  ? t.match_pending()
                  : result?.timedOut
                    ? t.match_timed_out()
                    : result?.invalid
                      ? t.testcases_invalid_dash()
                      : (result?.matchCount ?? 0) === 1
                        ? t.testcases_match_count_one({ count: String(result?.matchCount ?? 0) })
                        : t.testcases_match_count_other({ count: String(result?.matchCount ?? 0) })}
        </span>
      </div>

      <div className="p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-1 p-0.5 bg-gray-100 dark:bg-gray-800 rounded-md w-fit max-w-full">
          {expectOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onUpdate({ expect: opt.value })}
              aria-pressed={tc.expect === opt.value}
              className={`px-2 py-0.5 text-[11px] whitespace-nowrap font-medium rounded transition-colors ${
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
            aria-label={t.testcases_edit_input()}
            wrap={inputTruncated ? 'off' : 'soft'}
            value={tc.input}
            onChange={(e) => onUpdate({ input: e.target.value })}
            onBlur={() => setEditingInput(false)}
            rows={Math.min(6, Math.max(2, tc.input.split('\n').length))}
            className="w-full text-xs font-mono px-2 py-1.5 rounded-md border border-teal-400 dark:border-teal-500 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 outline-none resize-y"
          />
        ) : (
          <button
            onClick={() => setEditingInput(true)}
            aria-label={t.testcases_edit_input()}
            className="block w-full text-left text-xs font-mono px-2 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 transition-colors whitespace-pre-wrap break-all max-h-32 overflow-auto"
          >
            {inputPreview || (
              <span className="italic text-gray-400">{t.testcases_empty_input()}</span>
            )}
            {inputTruncated && (
              <span className="block mt-1 font-sans text-gray-500 dark:text-gray-400">
                {t.testcases_input_preview()}
              </span>
            )}
          </button>
        )}

        <details className="text-gray-700 dark:text-gray-200">
          <summary className="cursor-pointer text-xs font-medium py-1">
            {t.testcases_details()}
          </summary>
          <div className="space-y-3 pt-2">
            <button
              disabled={!canSnapshot(result)}
              onClick={() => {
                if (!canSnapshot(result) || !result?.actual) return;
                onUpdate({
                  expect: result.actual.matchCount ? 'match' : 'noMatch',
                  assertions: assertionsFromResult(result.actual),
                });
              }}
              className="px-2 py-1 rounded border border-teal-500 text-xs text-teal-700 dark:text-teal-300 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t.testcases_set_expected()}
            </button>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              {t.testcases_set_expected_hint()}
            </p>
            <TestAssertionsEditor
              assertions={tc.assertions}
              onChange={(assertions) => onUpdate({ assertions })}
            />
            {result?.actual && !result.pending && (
              <div>
                <h4 className="text-xs font-semibold mb-1">{t.testcases_actual()}</h4>
                {(result.actual.truncated || result.actual.detailsTruncated) && (
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    {t.testcases_details_truncated()}
                  </p>
                )}
                <pre
                  data-testid="test-actual"
                  className="text-[11px] font-mono whitespace-pre-wrap break-all rounded bg-gray-50 dark:bg-gray-900 p-2 max-h-64 overflow-auto"
                >
                  {JSON.stringify(assertionsFromResult(result.actual), null, 2)}
                </pre>
              </div>
            )}
          </div>
        </details>
        {!!result?.differences?.length && (
          <div
            data-testid="test-differences"
            className="rounded border border-red-200 dark:border-red-900 p-2 space-y-2"
          >
            {result.differences.map((difference) => (
              <div key={difference.field}>
                <h4 className="text-xs font-semibold text-red-700 dark:text-red-300">
                  {labels[difference.field]}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-gray-500">{t.testcases_expected()}</span>
                    <pre className="font-mono whitespace-pre-wrap break-all max-h-32 overflow-auto">
                      {displayDifference(difference.field, difference.expected)}
                    </pre>
                  </div>
                  <div>
                    <span className="text-gray-500">{t.testcases_actual()}</span>
                    <pre className="font-mono whitespace-pre-wrap break-all max-h-32 overflow-auto">
                      {displayDifference(difference.field, difference.actual)}
                    </pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {result?.replacementError && (
          <p className="text-xs text-amber-700 dark:text-amber-300">{result.replacementError}</p>
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
