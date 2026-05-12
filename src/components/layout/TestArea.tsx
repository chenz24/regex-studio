import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { Copy, Check, EyeOff, Eye } from 'lucide-react';
import {
  EditorView,
  keymap,
  placeholder as cmPlaceholder,
  type ViewUpdate,
  Decoration,
  type DecorationSet,
  hoverTooltip,
  highlightWhitespace,
} from '@codemirror/view';
import { EditorState, Compartment, StateField, StateEffect } from '@codemirror/state';
import { defaultKeymap } from '@codemirror/commands';
import type { MatchInfo } from '../../types/regex';
import { useT } from '@/lib/i18n';

// ─── Props ────────────────────────────────────────────────────────────

interface TestAreaProps {
  text: string;
  onTextChange: (value: string) => void;
  matches: MatchInfo[];
  selectedMatch: number | null;
  onSelectMatch: (index: number | null) => void;
}

// ─── Match Colors ─────────────────────────────────────────────────────

const MATCH_COLORS = [
  {
    bg: 'rgba(20, 184, 166, 0.18)',
    border: 'rgba(20, 184, 166, 0.5)',
    selected: 'rgba(20, 184, 166, 0.35)',
  },
  {
    bg: 'rgba(59, 130, 246, 0.18)',
    border: 'rgba(59, 130, 246, 0.5)',
    selected: 'rgba(59, 130, 246, 0.35)',
  },
];

// ─── CodeMirror Theme ─────────────────────────────────────────────────

const testAreaTheme = EditorView.theme({
  '&': {
    fontSize: '14px',
    fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace",
  },
  '.cm-content': {
    padding: '16px',
    caretColor: 'inherit',
    minHeight: '200px',
  },
  '.cm-line': {
    padding: '0',
    lineHeight: '1.75',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-scroller': {
    overflow: 'auto',
  },
  '.cm-placeholder': {
    color: '#9ca3af',
  },
  '.cm-highlightSpace:before': {
    color: 'rgba(156, 163, 175, 0.4)',
  },
  // Match highlight classes — generated dynamically by color index
  '.cm-match-0': {
    backgroundColor: MATCH_COLORS[0].bg,
    borderBottom: `2px solid ${MATCH_COLORS[0].border}`,
    borderRadius: '2px',
  },
  '.cm-match-1': {
    backgroundColor: MATCH_COLORS[1].bg,
    borderBottom: `2px solid ${MATCH_COLORS[1].border}`,
    borderRadius: '2px',
  },
  '.cm-match-0-selected': {
    backgroundColor: MATCH_COLORS[0].selected,
    borderBottom: `2px solid ${MATCH_COLORS[0].border}`,
    borderRadius: '2px',
  },
  '.cm-match-1-selected': {
    backgroundColor: MATCH_COLORS[1].selected,
    borderBottom: `2px solid ${MATCH_COLORS[1].border}`,
    borderRadius: '2px',
  },
  '.cm-tooltip-match': {
    backgroundColor: '#1f2937',
    color: '#e5e7eb',
    border: '1px solid #374151',
    borderRadius: '8px',
    padding: '8px 12px',
    fontSize: '12px',
    fontFamily: "'SF Mono', 'Fira Code', monospace",
    lineHeight: '1.6',
    maxWidth: '340px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
  },
  '.cm-tooltip-match .match-label': {
    color: '#9ca3af',
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontWeight: '600',
    marginBottom: '2px',
  },
  '.cm-tooltip-match .match-value': {
    color: '#f9fafb',
    fontWeight: '500',
  },
  '.cm-tooltip-match .match-range': {
    color: '#6b7280',
  },
  '.cm-tooltip-match .match-group': {
    color: '#a78bfa',
    marginTop: '4px',
  },
  '.cm-tooltip-match .match-divider': {
    borderTop: '1px solid #374151',
    margin: '6px 0',
  },
});

const lightTheme = EditorView.theme({
  '.cm-content': { caretColor: '#111827', color: '#111827' },
});

const darkTheme = EditorView.theme({
  '.cm-content': { caretColor: '#f3f4f6', color: '#d1d5db' },
  '.cm-placeholder': { color: '#4b5563' },
  // Dark mode match colors — slightly brighter
  '.cm-match-0': {
    backgroundColor: 'rgba(45, 212, 191, 0.2)',
    borderBottom: '2px solid rgba(45, 212, 191, 0.5)',
  },
  '.cm-match-1': {
    backgroundColor: 'rgba(96, 165, 250, 0.2)',
    borderBottom: '2px solid rgba(96, 165, 250, 0.5)',
  },
  '.cm-match-0-selected': {
    backgroundColor: 'rgba(45, 212, 191, 0.35)',
    borderBottom: '2px solid rgba(45, 212, 191, 0.6)',
  },
  '.cm-match-1-selected': {
    backgroundColor: 'rgba(96, 165, 250, 0.35)',
    borderBottom: '2px solid rgba(96, 165, 250, 0.6)',
  },
});

// ─── State Effects & Fields ───────────────────────────────────────────

const setMatchDecorations = StateEffect.define<DecorationSet>();

const matchField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setMatchDecorations)) return e.value;
    }
    return value.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

// ─── Component ────────────────────────────────────────────────────────

export function TestArea({
  text,
  onTextChange,
  matches,
  selectedMatch,
  onSelectMatch,
}: TestAreaProps) {
  const t = useT();
  const tRef = useRef(t);
  tRef.current = t;
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const isExternalUpdate = useRef(false);
  const onChangeRef = useRef(onTextChange);
  const matchesRef = useRef(matches);
  const selectedMatchRef = useRef(selectedMatch);
  const onSelectMatchRef = useRef(onSelectMatch);
  const [copied, setCopied] = useState(false);
  const [showWhitespace, setShowWhitespace] = useState(false);

  onChangeRef.current = onTextChange;
  matchesRef.current = matches;
  selectedMatchRef.current = selectedMatch;
  onSelectMatchRef.current = onSelectMatch;

  // Compartments
  const themeCompartment = useRef(new Compartment());
  const whitespaceCompartment = useRef(new Compartment());

  // Capture the initial doc so the mount-only init effect can read it
  // without taking `text` as a dependency (which would rebuild the
  // EditorView on every keystroke — wiping cursor, history, and stealing focus).
  const initialTextRef = useRef(text);

  // Hover tooltip for match details
  const matchTooltip = useMemo(
    () =>
      hoverTooltip(
        (_view, pos) => {
          const currentMatches = matchesRef.current;
          if (!currentMatches.length) return null;

          // Find which match the cursor is hovering
          for (let i = 0; i < currentMatches.length; i++) {
            const m = currentMatches[i];
            if (pos >= m.start && pos < m.end) {
              return {
                pos: m.start,
                end: m.end,
                above: true,
                create() {
                  const dom = document.createElement('div');
                  dom.className = 'cm-tooltip-match';

                  const tt = tRef.current;
                  let html = '';
                  html += `<div class="match-label">${escapeHtml(tt.testarea_tooltip_match_label())}: <span class="match-value">${escapeHtml(m.match)}</span></div>`;
                  html += `<div class="match-range">${escapeHtml(tt.testarea_tooltip_range_label())}: ${m.start}–${m.end}</div>`;

                  if (m.groups.length > 0) {
                    html += '<div class="match-divider"></div>';
                    const groupLabel = tt.testarea_tooltip_group_label();
                    for (const g of m.groups) {
                      if (g.value !== undefined) {
                        const label = g.name
                          ? `${escapeHtml(g.name)} (#${g.index})`
                          : `${escapeHtml(groupLabel)} #${g.index}`;
                        html += `<div class="match-group">${label}: <span class="match-value">${escapeHtml(g.value)}</span></div>`;
                      }
                    }
                  }

                  dom.innerHTML = html;

                  // Clicking the tooltip selects the match
                  dom.addEventListener('click', () => {
                    onSelectMatchRef.current(i);
                  });

                  return { dom };
                },
              };
            }
          }
          return null;
        },
        { hoverTime: 200 },
      ),
    [],
  );

  // Initialize editor (mount-only). `matchTooltip` is memoized with an
  // empty dep list so its identity is stable across renders and excluding
  // it here is safe.
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only init
  useEffect(() => {
    if (!editorRef.current) return;

    const isDark = document.documentElement.classList.contains('dark');

    const state = EditorState.create({
      doc: initialTextRef.current,
      extensions: [
        testAreaTheme,
        themeCompartment.current.of(isDark ? darkTheme : lightTheme),
        whitespaceCompartment.current.of([]),
        keymap.of(defaultKeymap),
        cmPlaceholder(t.testarea_placeholder()),
        matchField,
        matchTooltip,
        EditorView.lineWrapping,
        EditorView.updateListener.of((update: ViewUpdate) => {
          if (update.docChanged && !isExternalUpdate.current) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
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
    // Mount-only: the EditorView is created once. External text changes
    // are synced via the dedicated effect below using `view.dispatch`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync text from outside
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentDoc = view.state.doc.toString();
    if (currentDoc !== text) {
      isExternalUpdate.current = true;
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: text },
      });
      isExternalUpdate.current = false;
    }
  }, [text]);

  // Sync match decorations
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const docLen = view.state.doc.length;
    const decorations: { from: number; to: number; decoration: Decoration }[] = [];

    matches.forEach((m, i) => {
      const from = Math.min(m.start, docLen);
      const to = Math.min(m.end, docLen);
      if (from >= to) return;

      const colorIdx = i % MATCH_COLORS.length;
      const isSelected = selectedMatch === i;
      const className = isSelected ? `cm-match-${colorIdx}-selected` : `cm-match-${colorIdx}`;

      decorations.push({
        from,
        to,
        decoration: Decoration.mark({ class: className }),
      });
    });

    // Sort by from position (required by CodeMirror)
    decorations.sort((a, b) => a.from - b.from || a.to - b.to);

    const decoSet = Decoration.set(decorations.map((d) => d.decoration.range(d.from, d.to)));

    view.dispatch({
      effects: setMatchDecorations.of(decoSet),
    });
  }, [matches, selectedMatch]);

  // Sync theme
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.classList.contains('dark');
      view.dispatch({
        effects: themeCompartment.current.reconfigure(isDark ? darkTheme : lightTheme),
      });
    });

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Sync whitespace visibility
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: whitespaceCompartment.current.reconfigure(
        showWhitespace ? highlightWhitespace() : [],
      ),
    });
  }, [showWhitespace]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [text]);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700/80 bg-white dark:bg-gray-900/60 overflow-hidden shadow-sm h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 dark:border-gray-700/80">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
            {t.testarea_title()}
          </span>
          <button
            onClick={() => setShowWhitespace(!showWhitespace)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
              showWhitespace
                ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            {showWhitespace ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            {showWhitespace ? t.testarea_hide_whitespace() : t.testarea_show_whitespace()}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-md">
            {matches.length === 1
              ? t.testarea_match_count_one({ count: String(matches.length) })
              : t.testarea_match_count_other({ count: String(matches.length) })}
          </span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      </div>

      <div ref={editorRef} className="flex-1 min-h-[200px] p-3 overflow-auto custom-scrollbar" />
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
