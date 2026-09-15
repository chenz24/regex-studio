import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { ASTNode } from '../../types/regex';
import { runMatch } from '../../utils/matchEngine';
import { editPcre2Node, pcre2AtomKind, pcre2EditTarget } from '../../utils/pcre2PatternEditor';
import { useT } from '@/lib/i18n';

interface Props {
  ast: ASTNode;
  selectedNodeId: string;
  pattern: string;
  flags: string;
  onPatternChange: (pattern: string) => void;
  onClose: () => void;
}

/** The banner keys this component by source, flags and selection to discard stale drafts. */
export function Pcre2NodeEditor({
  ast,
  selectedNodeId,
  pattern,
  flags,
  onPatternChange,
  onClose,
}: Props) {
  const t = useT();
  const target = pcre2EditTarget(ast, selectedNodeId);
  const atom = target?.type === 'quantifier' ? target.children?.[0] : target;
  const kind = atom && pcre2AtomKind(atom);
  const [value, setValue] = useState(kind === 'literal' ? atom!.value : (atom?.raw ?? ''));
  const [quantifier, setQuantifier] = useState(target?.quantifier?.raw ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  let candidate = pattern;
  let draftError = '';
  const supported = !!kind || target?.type === 'quantifier';
  if (target && supported) {
    try {
      candidate = editPcre2Node(pattern, target, value, quantifier);
    } catch (e) {
      draftError =
        e instanceof Error && e.message === 'class'
          ? t.pcre2_edit_class_error()
          : t.pcre2_edit_quant_error();
    }
  }
  const apply = async () => {
    if (pending || draftError || candidate === pattern || !supported) return;
    setPending(true);
    setError('');
    try {
      const result = await runMatch({
        engine: 'pcre2',
        validateOnly: true,
        pattern: candidate,
        flags,
        text: '',
        replacement: '',
        testInputs: [],
      });
      if (!alive.current) return;
      if (result.timedOut || result.executionError || !result.validation?.valid) {
        setError(
          result.executionError ?? result.validation?.error ?? t.pcre2_edit_validation_failed(),
        );
        return;
      }
      onPatternChange(candidate);
      onClose();
    } catch {
      if (alive.current) setError(t.pcre2_edit_validation_failed());
    } finally {
      if (alive.current) setPending(false);
    }
  };
  const inputStyle =
    'w-full min-w-0 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2 font-mono text-xs disabled:opacity-50';
  return (
    <section
      aria-label={t.pcre2_edit_title()}
      className="border-t sm:border-t-0 sm:border-l border-gray-200 dark:border-gray-700 p-3 space-y-3 text-xs text-gray-700 dark:text-gray-200"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">{t.pcre2_edit_title()}</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.pcre2_edit_close()}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      {!supported ? (
        <p>{t.pcre2_edit_unsupported()}</p>
      ) : (
        <>
          {kind && (
            <label className="block space-y-1">
              <span>{kind === 'literal' ? t.pcre2_edit_literal() : t.pcre2_edit_class()}</span>
              <textarea
                rows={2}
                className={inputStyle}
                value={value}
                disabled={pending}
                onChange={(e) => {
                  setValue(e.target.value);
                  setError('');
                }}
              />
            </label>
          )}
          <label className="block space-y-1">
            <span>{t.pcre2_edit_quantifier()}</span>
            <input
              className={inputStyle}
              value={quantifier}
              disabled={pending}
              placeholder="?  *  +  {2,4}  ++"
              onChange={(e) => {
                setQuantifier(e.target.value);
                setError('');
              }}
            />
          </label>
          <p className="text-gray-500 dark:text-gray-400">{t.pcre2_edit_hint()}</p>
          <div className="space-y-1">
            <span>{t.pcre2_edit_preview()}</span>
            <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-all rounded bg-gray-50 dark:bg-gray-800 p-2">
              {candidate}
            </pre>
          </div>
          {(draftError || error) && (
            <p role="alert" className="text-red-600 dark:text-red-400 break-words">
              {draftError || error}
            </p>
          )}
          <button
            type="button"
            onClick={apply}
            disabled={pending || !!draftError || candidate === pattern}
            className="w-full rounded-md bg-blue-600 px-3 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {pending ? t.pcre2_edit_validating() : t.pcre2_edit_apply()}
          </button>
        </>
      )}
    </section>
  );
}
