import { useState, useRef, useEffect, useCallback } from 'react';
import { AlertCircle, Check, Copy, Trash2 } from 'lucide-react';
import {
  EditorView,
  keymap,
  placeholder as cmPlaceholder,
  type ViewUpdate,
  Decoration,
  type DecorationSet,
} from '@codemirror/view';
import { EditorState, Compartment, StateField, StateEffect } from '@codemirror/state';
import { defaultKeymap } from '@codemirror/commands';
import { HighlightStyle, syntaxHighlighting, StreamLanguage } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { FlavorSelector } from './FlavorSelector';
import { CompatibilityWarnings } from './CompatibilityWarnings';
import type { RegexFlag, ASTNode } from '../../types/regex';
import type { RegexEngine, CompatibilityWarning } from '../../types/engineTypes';
import { ENGINE_FLAVORS } from '../../types/engineTypes';
import { findNodeById, findNodeAtPosition } from '../../lib/ast';
import { useT } from '@/lib/i18n';

interface RegexInputProps {
  pattern: string;
  onPatternChange: (value: string) => void;
  flags: RegexFlag[];
  flagString: string;
  onToggleFlag: (key: string) => void;
  validation: { valid: boolean; error?: string };
  matchCount: number;
  ast: ASTNode;
  hoveredNodeId: string | null;
  onHoverNode: (id: string | null) => void;
  engine: RegexEngine;
  onEngineChange: (engine: RegexEngine) => void;
  compatibilityWarnings: CompatibilityWarning[];
}

const regexLanguage = StreamLanguage.define({
  token(stream) {
    if (stream.match('\\')) {
      stream.next();
      return 'escape';
    }
    if (stream.match(/^\[(\^)?/)) {
      while (!stream.eol()) {
        if (stream.eat('\\')) {
          stream.next();
          continue;
        }
        if (stream.eat(']')) return 'className';
        stream.next();
      }
      return 'className';
    }
    if (stream.eat('(')) {
      stream.match(/^\?[:=!]|^\?<[!=]|^\?<\w+>/);
      return 'paren';
    }
    if (stream.eat(')')) return 'paren';
    if (stream.eat('|')) return 'operator';
    if (stream.eat('^') || stream.eat('$')) return 'meta';
    if (stream.eat('.')) return 'atom';
    if (stream.match(/^[?*+]\??/) || stream.match(/^\{[\d,]+\}\??/)) return 'number';
    stream.next();
    return null;
  },
});

const lightHighlight = HighlightStyle.define([
  { tag: tags.escape, color: '#ea580c' },
  { tag: tags.className, color: '#d97706' },
  { tag: tags.paren, color: '#059669', fontWeight: '600' },
  { tag: tags.operator, color: '#2563eb', fontWeight: '600' },
  { tag: tags.meta, color: '#e11d48', fontWeight: '600' },
  { tag: tags.atom, color: '#ea580c' },
  { tag: tags.number, color: '#2563eb' },
]);

const darkHighlight = HighlightStyle.define([
  { tag: tags.escape, color: '#fb923c' },
  { tag: tags.className, color: '#fbbf24' },
  { tag: tags.paren, color: '#34d399', fontWeight: '600' },
  { tag: tags.operator, color: '#60a5fa', fontWeight: '600' },
  { tag: tags.meta, color: '#fb7185', fontWeight: '600' },
  { tag: tags.atom, color: '#fb923c' },
  { tag: tags.number, color: '#60a5fa' },
]);

const regexInputTheme = EditorView.theme({
  '&': {
    fontSize: '16px',
    fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace",
    height: '100%',
  },
  '.cm-content': {
    padding: '0',
    minHeight: '1.5em',
  },
  '.cm-line': {
    padding: '0',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-scroller': {
    overflow: 'hidden',
    lineHeight: '1.5',
    padding: '10px 12px',
  },
  '.cm-placeholder': {
    color: '#9ca3af',
  },
  '.cm-hover-highlight': {
    backgroundColor: 'rgba(20, 184, 166, 0.15)',
    borderRadius: '2px',
    boxShadow: '0 0 0 1px rgba(20, 184, 166, 0.3)',
  },
});

const lightTheme = EditorView.theme({
  '.cm-content': { caretColor: '#111827', color: '#111827' },
});

const darkTheme = EditorView.theme({
  '.cm-content': { caretColor: '#f3f4f6', color: '#d1d5db' },
  '.cm-placeholder': { color: '#4b5563' },
  '.cm-hover-highlight': {
    backgroundColor: 'rgba(45, 212, 191, 0.2)',
    boxShadow: '0 0 0 1px rgba(45, 212, 191, 0.4)',
  },
});

const setHighlightEffect = StateEffect.define<DecorationSet>();

const highlightField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setHighlightEffect)) return e.value;
    }
    return value.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

const hoverMark = Decoration.mark({ class: 'cm-hover-highlight' });

export function RegexInput({
  pattern,
  onPatternChange,
  flags,
  flagString,
  onToggleFlag,
  validation,
  matchCount,
  ast,
  hoveredNodeId,
  onHoverNode,
  engine,
  onEngineChange,
  compatibilityWarnings,
}: RegexInputProps) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const isExternalUpdate = useRef(false);
  const onChangeRef = useRef(onPatternChange);
  const onHoverRef = useRef(onHoverNode);
  const astRef = useRef(ast);
  const themeCompartment = useRef(new Compartment());
  const highlightCompartment = useRef(new Compartment());

  onChangeRef.current = onPatternChange;
  onHoverRef.current = onHoverNode;
  astRef.current = ast;

  // Capture the initial pattern so the editor init effect can read it without
  // taking `pattern` as a dependency (which would re-create the EditorView on
  // every keystroke and steal focus).
  const initialPatternRef = useRef(pattern);

  useEffect(() => {
    if (!editorRef.current) return;

    const onUpdate = EditorView.updateListener.of((update: ViewUpdate) => {
      if (isExternalUpdate.current) return;
      if (update.docChanged) {
        onChangeRef.current(update.state.doc.toString());
      }
    });

    const singleLine = EditorState.transactionFilter.of((tr) => {
      if (!tr.docChanged) return tr;
      const newDoc = tr.newDoc.toString();
      if (newDoc.includes('\n')) {
        return {
          ...tr,
          changes: { from: 0, to: tr.startState.doc.length, insert: newDoc.replace(/\n/g, '') },
        };
      }
      return tr;
    });

    const isDark = document.documentElement.classList.contains('dark');

    const state = EditorState.create({
      doc: initialPatternRef.current,
      extensions: [
        regexInputTheme,
        themeCompartment.current.of(isDark ? darkTheme : lightTheme),
        regexLanguage,
        highlightCompartment.current.of(
          syntaxHighlighting(isDark ? darkHighlight : lightHighlight),
        ),
        keymap.of(defaultKeymap),
        cmPlaceholder(t.regex_input_placeholder()),
        onUpdate,
        singleLine,
        EditorView.lineWrapping,
        highlightField,
      ],
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Mount-only: the EditorView is created once. External pattern changes
    // are synced via the dedicated effect below using `view.dispatch`.
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const el = view.dom;
    let lastHoveredId: string | null = null;

    const handleMouseMove = (e: MouseEvent) => {
      const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
      if (pos === null) {
        if (lastHoveredId !== null) {
          lastHoveredId = null;
          onHoverRef.current(null);
        }
        return;
      }
      const node = findNodeAtPosition(astRef.current, pos);
      const id = node ? node.id : null;
      if (id !== lastHoveredId) {
        lastHoveredId = id;
        onHoverRef.current(id);
      }
    };

    const handleMouseLeave = () => {
      if (lastHoveredId !== null) {
        lastHoveredId = null;
        onHoverRef.current(null);
      }
    };

    el.addEventListener('mousemove', handleMouseMove);
    el.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      el.removeEventListener('mousemove', handleMouseMove);
      el.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.classList.contains('dark');
      view.dispatch({
        effects: [
          themeCompartment.current.reconfigure(isDark ? darkTheme : lightTheme),
          highlightCompartment.current.reconfigure(
            syntaxHighlighting(isDark ? darkHighlight : lightHighlight),
          ),
        ],
      });
    });

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentDoc = view.state.doc.toString();
    if (currentDoc !== pattern) {
      isExternalUpdate.current = true;
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: pattern },
      });
      isExternalUpdate.current = false;
    }
  }, [pattern]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    if (!hoveredNodeId) {
      view.dispatch({ effects: setHighlightEffect.of(Decoration.none) });
      return;
    }

    const node = findNodeById(ast, hoveredNodeId);
    if (!node || node.start >= node.end) {
      view.dispatch({ effects: setHighlightEffect.of(Decoration.none) });
      return;
    }

    const docLen = view.state.doc.length;
    const from = Math.min(node.start, docLen);
    const to = Math.min(node.end, docLen);

    if (from >= to) {
      view.dispatch({ effects: setHighlightEffect.of(Decoration.none) });
      return;
    }

    const decos = Decoration.set([hoverMark.range(from, to)]);
    view.dispatch({ effects: setHighlightEffect.of(decos) });
  }, [hoveredNodeId, ast]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(`/${pattern}/${flagString}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [pattern, flagString]);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FlavorSelector
            engine={engine}
            onEngineChange={onEngineChange}
            warningCount={compatibilityWarnings.length}
          />
        </div>

        <TooltipProvider>
          <div className="flex items-center gap-1 p-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            {flags.map((flag) => (
              <Tooltip key={flag.key}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onToggleFlag(flag.key)}
                    className={`w-7 h-7 flex items-center justify-center rounded-md font-mono text-sm font-bold transition-all ${
                      flag.enabled
                        ? 'bg-teal-500 text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-white dark:hover:bg-gray-700'
                    }`}
                  >
                    {flag.label}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={8}>
                  <div className="font-semibold">{flag.label}</div>
                  <div className="opacity-80 mt-0.5">{flag.description}</div>
                  {!flag.jsFlag && (
                    <div className="opacity-60 mt-1 text-[10px]">
                      {t.regex_input_display_only()}
                    </div>
                  )}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </TooltipProvider>
      </div>

      <div className="relative group">
        <div
          className={`flex items-center rounded-xl border-2 transition-all bg-white dark:bg-gray-800/80 shadow-sm ${
            !pattern
              ? 'border-gray-200 dark:border-gray-700'
              : validation.valid
                ? 'border-teal-400/60 dark:border-teal-500/60 focus-within:border-teal-400 dark:focus-within:border-teal-500 focus-within:shadow-[0_0_0_3px_rgba(20,184,166,0.1)]'
                : 'border-red-400/60 dark:border-red-500/60 shadow-[0_0_0_2px_rgba(239,68,68,0.1)]'
          }`}
        >
          <div className="px-4 py-3 text-gray-300 dark:text-gray-600 select-none font-mono text-lg border-r border-gray-100 dark:border-gray-700/60 bg-gray-50/50 dark:bg-gray-900/30 rounded-l-xl">
            /
          </div>

          <div className="flex-1 min-w-0 cursor-text" ref={editorRef} />

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity px-1">
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              onClick={() => onPatternChange('')}
              className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="px-4 py-3 text-gray-300 dark:text-gray-600 select-none font-mono text-lg border-l border-gray-100 dark:border-gray-700/60 bg-gray-50/50 dark:bg-gray-900/30 rounded-r-xl flex items-center gap-1">
            /{flagString}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3">
          {pattern && validation.valid && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
              <Check className="w-3.5 h-3.5" />
              {matchCount === 1
                ? t.regex_input_match_count_one({ count: String(matchCount) })
                : t.regex_input_match_count_other({ count: String(matchCount) })}
            </span>
          )}
          {pattern && !validation.valid && (
            <span className="flex items-center gap-1.5 text-sm text-red-500">
              <AlertCircle className="w-3.5 h-3.5" />
              {validation.error}
            </span>
          )}
        </div>
      </div>

      <CompatibilityWarnings
        warnings={compatibilityWarnings}
        engineName={ENGINE_FLAVORS[engine].name}
      />
    </div>
  );
}
