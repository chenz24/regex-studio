import { useState } from 'react';
import type { TestAssertions } from '../../types/regex';
import { validAssertions } from '../../lib/testCases';
import { useT } from '@/lib/i18n';

export function useAssertionLabels() {
  const t = useT();
  return {
    expect: t.testcases_outcome(),
    count: t.testcases_assert_count(),
    texts: t.testcases_assert_texts(),
    ranges: t.testcases_assert_ranges(),
    captures: t.testcases_assert_captures(),
    replacement: t.testcases_assert_replacement(),
  };
}

export function TestAssertionsEditor({
  assertions = {},
  onChange,
}: {
  assertions?: TestAssertions;
  onChange: (value: TestAssertions) => void;
}) {
  const t = useT();
  const labels = useAssertionLabels();
  const defaults: Required<TestAssertions> = {
    count: 1,
    texts: [],
    ranges: [],
    captures: [],
    replacement: '',
  };
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-semibold mb-2">{t.testcases_assertions()}</legend>
      <p className="text-[11px] text-gray-500 dark:text-gray-400">
        {t.testcases_assertions_hint()}
      </p>
      {(Object.keys(defaults) as (keyof TestAssertions)[]).map((field) => (
        <div key={field} className="space-y-1">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={assertions[field] !== undefined}
              onChange={(event) => {
                const next = { ...assertions };
                if (event.target.checked) Object.assign(next, { [field]: defaults[field] });
                else delete next[field];
                onChange(next);
              }}
            />
            {labels[field]}
          </label>
          {assertions[field] !== undefined && (
            <AssertionValue
              key={JSON.stringify(assertions[field])}
              field={field}
              value={assertions[field]}
              label={labels[field]}
              onChange={(value) => onChange({ ...assertions, [field]: value })}
            />
          )}
        </div>
      ))}
    </fieldset>
  );
}

function AssertionValue({
  field,
  value,
  label,
  onChange,
}: {
  field: keyof TestAssertions;
  value: unknown;
  label: string;
  onChange: (value: unknown) => void;
}) {
  const t = useT();
  const [draft, setDraft] = useState(() =>
    field === 'replacement' ? String(value) : JSON.stringify(value, null, 2),
  );
  const [error, setError] = useState(false);
  const original = field === 'replacement' ? String(value) : JSON.stringify(value, null, 2);
  const save = () => {
    try {
      const parsed = field === 'replacement' ? draft : JSON.parse(draft);
      if (!validAssertions({ [field]: parsed })) throw new Error('Invalid expectation');
      setError(false);
      setDraft(field === 'replacement' ? String(parsed) : JSON.stringify(parsed, null, 2));
      onChange(parsed);
    } catch {
      setError(true);
    }
  };
  return (
    <div className="pl-5 space-y-1">
      <textarea
        aria-label={t.testcases_expected_field({ field: label })}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          setError(false);
        }}
        rows={field === 'count' ? 1 : Math.min(8, Math.max(2, draft.split('\n').length))}
        className="w-full rounded border border-gray-300 dark:border-gray-600 bg-transparent px-2 py-1 font-mono text-xs resize-y"
      />
      {field === 'replacement' && (
        <p className="text-[11px] text-gray-500">{t.testcases_replacement_hint()}</p>
      )}
      {draft !== original && (
        <button onClick={save} className="text-xs text-teal-700 dark:text-teal-300 underline">
          {t.testcases_save_expectation()}
        </button>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {t.testcases_assertion_invalid()}
        </p>
      )}
      {draft !== original && !error && (
        <p className="text-[11px] text-amber-700 dark:text-amber-300">{t.testcases_unsaved()}</p>
      )}
    </div>
  );
}
