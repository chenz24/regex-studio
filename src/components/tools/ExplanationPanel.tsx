import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import type { ASTNode } from '../../types/regex';
import { useT, type Messages } from '@/lib/i18n';

interface ExplanationPanelProps {
  ast: ASTNode;
  hoveredNodeId: string | null;
  onHoverNode: (id: string | null) => void;
  /** Tutorial spotlight — ids whose entries get an amber outline. */
  spotlightNodeIds?: Set<string>;
  /** First spotlighted node id; the panel scrolls it into view. */
  spotlightFirstNodeId?: string | null;
}

interface SpotlightCtxValue {
  ids: Set<string>;
  registerRef: (id: string, el: HTMLDivElement | null) => void;
}

const SpotlightCtx = createContext<SpotlightCtxValue | null>(null);

const STYLES = {
  green: {
    border: 'border-emerald-500 dark:border-emerald-400',
    bg: 'bg-emerald-500/5 dark:bg-emerald-400/5',
    text: 'text-emerald-600 dark:text-emerald-400',
    glow: 'rgba(16, 185, 129, 0.15)',
  },
  yellow: {
    border: 'border-amber-500 dark:border-amber-400',
    bg: 'bg-amber-500/5 dark:bg-amber-400/5',
    text: 'text-amber-600 dark:text-amber-400',
    glow: 'rgba(245, 158, 11, 0.15)',
  },
  blue: {
    border: 'border-sky-500 dark:border-sky-400',
    bg: 'bg-sky-500/5 dark:bg-sky-400/5',
    text: 'text-sky-600 dark:text-sky-400',
    glow: 'rgba(14, 165, 233, 0.15)',
  },
  orange: {
    border: 'border-orange-500 dark:border-orange-400',
    bg: 'bg-orange-500/5 dark:bg-orange-400/5',
    text: 'text-orange-600 dark:text-orange-400',
    glow: 'rgba(249, 115, 22, 0.15)',
  },
  slate: {
    border: 'border-gray-400 dark:border-gray-500',
    bg: 'bg-gray-100/50 dark:bg-gray-800/30',
    text: 'text-gray-600 dark:text-gray-400',
    glow: 'transparent',
  },
  rose: {
    border: 'border-rose-500 dark:border-rose-400',
    bg: 'bg-rose-500/5 dark:bg-rose-400/5',
    text: 'text-rose-600 dark:text-rose-400',
    glow: 'rgba(244, 63, 94, 0.15)',
  },
  cyan: {
    border: 'border-cyan-500 dark:border-cyan-400',
    bg: 'bg-cyan-500/5 dark:bg-cyan-400/5',
    text: 'text-cyan-600 dark:text-cyan-400',
    glow: 'rgba(6, 182, 212, 0.15)',
  },
  tealHighlight: {
    border: 'border-teal-500 dark:border-teal-400',
    bg: 'bg-teal-500/10 dark:bg-teal-400/10',
    text: 'text-teal-600 dark:text-teal-400',
    glow: 'rgba(20, 184, 166, 0.25)',
  },
} as const;

function escapeDesc(t: Messages, value: string): string {
  switch (value) {
    case '\\d':
      return t.explain_escape_d();
    case '\\D':
      return t.explain_escape_D();
    case '\\w':
      return t.explain_escape_w();
    case '\\W':
      return t.explain_escape_W();
    case '\\s':
      return t.explain_escape_s();
    case '\\S':
      return t.explain_escape_S();
    case '\\b':
      return t.explain_escape_b();
    case '\\B':
      return t.explain_escape_B();
    case '\\n':
      return t.explain_escape_n();
    case '\\t':
      return t.explain_escape_t();
    case '\\r':
      return t.explain_escape_r();
    default:
      return t.explain_escape_other({ char: value.slice(1) });
  }
}

interface NodeMeta {
  color: keyof typeof STYLES;
  title: string;
  desc: string;
  openChar: string;
  closeChar: string;
}

function getQuantifierDesc(t: Messages, raw: string): string {
  if (raw.startsWith('{')) {
    const inner = raw.replace('?', '').slice(1, -1);
    if (inner.includes(',')) {
      const [min, max] = inner.split(',');
      if (!max) return t.explain_quant_brace_min_or_more({ min });
      return t.explain_quant_brace_min_max({ min, max });
    }
    return t.explain_quant_brace_exact({ n: inner });
  }
  const base = raw.replace('?', '');
  const lazy = raw.endsWith('?') && raw.length > 1 ? t.explain_quant_lazy_suffix() : '';
  if (base === '+') return `${t.explain_quant_plus()}${lazy}`;
  if (base === '*') return `${t.explain_quant_star()}${lazy}`;
  if (base === '?') return t.explain_quant_optional();
  return t.explain_quant_other({ raw });
}

function getNodeMeta(t: Messages, node: ASTNode): NodeMeta {
  switch (node.type) {
    case 'group':
      return {
        color: 'green',
        title: t.explain_capturing_group_title({ idx: String(node.groupIndex ?? '') }),
        desc: t.explain_capturing_group_desc(),
        openChar: '(',
        closeChar: ')',
      };
    case 'nonCapturingGroup':
      return {
        color: 'green',
        title: t.explain_noncap_group_title(),
        desc: t.explain_noncap_group_desc(),
        openChar: '(?:',
        closeChar: ')',
      };
    case 'namedGroup':
      return {
        color: 'green',
        title: t.explain_named_group_title({ name: node.groupName ?? '' }),
        desc: t.explain_named_group_desc({ name: node.groupName ?? '' }),
        openChar: `(?<${node.groupName}>`,
        closeChar: ')',
      };
    case 'lookahead':
      return {
        color: 'cyan',
        title: t.explain_lookahead_title(),
        desc: t.explain_lookahead_desc(),
        openChar: '(?=',
        closeChar: ')',
      };
    case 'negativeLookahead':
      return {
        color: 'cyan',
        title: t.explain_neg_lookahead_title(),
        desc: t.explain_neg_lookahead_desc(),
        openChar: '(?!',
        closeChar: ')',
      };
    case 'lookbehind':
      return {
        color: 'cyan',
        title: t.explain_lookbehind_title(),
        desc: t.explain_lookbehind_desc(),
        openChar: '(?<=',
        closeChar: ')',
      };
    case 'negativeLookbehind':
      return {
        color: 'cyan',
        title: t.explain_neg_lookbehind_title(),
        desc: t.explain_neg_lookbehind_desc(),
        openChar: '(?<!',
        closeChar: ')',
      };
    case 'characterClass':
      return {
        color: 'yellow',
        title: t.explain_char_set_title(),
        desc: t.explain_char_set_desc(),
        openChar: '[',
        closeChar: ']',
      };
    case 'negatedCharacterClass':
      return {
        color: 'yellow',
        title: t.explain_neg_char_set_title(),
        desc: t.explain_neg_char_set_desc(),
        openChar: '[^',
        closeChar: ']',
      };
    case 'anchor':
      return {
        color: 'rose',
        title: node.value === '^' ? t.explain_anchor_start_title() : t.explain_anchor_end_title(),
        desc:
          node.value === '^' ? t.explain_anchor_start_desc() : t.explain_anchor_end_desc(),
        openChar: node.value,
        closeChar: '',
      };
    case 'alternation':
      return {
        color: 'blue',
        title: t.explain_alternation_title(),
        desc: t.explain_alternation_desc(),
        openChar: '|',
        closeChar: '',
      };
    case 'escape':
      return {
        color: 'orange',
        title: t.explain_escape_title(),
        desc: escapeDesc(t, node.value),
        openChar: node.value,
        closeChar: '',
      };
    case 'dot':
      return {
        color: 'orange',
        title: t.explain_dot_title(),
        desc: t.explain_dot_desc(),
        openChar: '.',
        closeChar: '',
      };
    case 'backreference':
      return {
        color: 'blue',
        title: t.explain_backreference_title({ n: node.value }),
        desc: t.explain_backreference_desc({ n: node.value }),
        openChar: node.raw,
        closeChar: '',
      };
    default:
      return {
        color: 'slate',
        title: t.explain_default_title(),
        desc: t.explain_default_desc({ char: node.value }),
        openChar: node.value,
        closeChar: '',
      };
  }
}

function ExplainNode({
  node,
  hoveredNodeId,
  onHoverNode,
}: {
  node: ASTNode;
  hoveredNodeId: string | null;
  onHoverNode: (id: string | null) => void;
}) {
  const t = useT();
  const handleEnter = useCallback(() => {
    onHoverNode(node.id);
  }, [node.id, onHoverNode]);

  const handleLeave = useCallback(() => {
    onHoverNode(null);
  }, [onHoverNode]);

  const isHighlighted = hoveredNodeId === node.id;
  const spotlightCtx = useContext(SpotlightCtx);
  const isSpotlighted = !!spotlightCtx?.ids.has(node.id);

  if (node.type === 'sequence') {
    return (
      <>
        {node.children?.map((child, i) => (
          <ExplainNode
            key={i}
            node={child}
            hoveredNodeId={hoveredNodeId}
            onHoverNode={onHoverNode}
          />
        ))}
      </>
    );
  }

  if (node.type === 'quantifier') {
    const child = node.children?.[0];
    const qRaw = node.quantifier?.raw || node.value;
    const st = isHighlighted ? STYLES.tealHighlight : STYLES.blue;
    return (
      <div className="space-y-0">
        {child && (
          <ExplainNode node={child} hoveredNodeId={hoveredNodeId} onHoverNode={onHoverNode} />
        )}
        <div
          ref={(el) => spotlightCtx?.registerRef(node.id, el)}
          className={`flex flex-col border-l-[3px] ${st.border} ${st.bg} mb-2 rounded-r-lg overflow-hidden text-sm transition-all cursor-pointer ${isSpotlighted ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-white dark:ring-offset-gray-900 spotlight-ring' : ''}`}
          style={{
            boxShadow: `-4px 0 12px -4px ${st.glow}`,
            transform: isHighlighted ? 'translateX(2px)' : 'none',
          }}
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
        >
          <div className="px-4 py-2.5">
            <div className="flex items-start gap-3">
              <span className={`font-mono font-bold text-base mt-px ${st.text}`}>{qRaw}</span>
              <div className="flex-1">
                <span className="font-semibold text-gray-800 dark:text-gray-200">{t.explain_quantifier_title()}. </span>
                <span className="text-gray-500 dark:text-gray-400">{getQuantifierDesc(t, qRaw)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (node.type === 'alternation') {
    return (
      <div className="space-y-1">
        {node.children?.map((branch, i) => (
          <div key={i}>
            {i > 0 && (
              <div
                className={`flex flex-col border-l-[3px] ${STYLES.blue.border} ${STYLES.blue.bg} mb-2 rounded-r-lg overflow-hidden text-sm`}
                style={{ boxShadow: `-4px 0 12px -4px ${STYLES.blue.glow}` }}
              >
                <div className="px-4 py-2">
                  <div className="flex items-start gap-3">
                    <span className={`font-mono font-bold text-base ${STYLES.blue.text}`}>|</span>
                    <div>
                      <span className="font-semibold text-gray-800 dark:text-gray-200">
                        {t.explain_alternation_title()}.{' '}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400">
                        {t.explain_alternation_desc()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <ExplainNode node={branch} hoveredNodeId={hoveredNodeId} onHoverNode={onHoverNode} />
          </div>
        ))}
      </div>
    );
  }

  const meta = getNodeMeta(t, node);
  const st = isHighlighted ? STYLES.tealHighlight : STYLES[meta.color];
  const hasChildren =
    node.children &&
    node.children.length > 0 &&
    !['characterClass', 'negatedCharacterClass'].includes(node.type);
  const isCharClass = node.type === 'characterClass' || node.type === 'negatedCharacterClass';

  return (
    <div
      ref={(el) => spotlightCtx?.registerRef(node.id, el)}
      className={`flex flex-col border-l-[3px] ${st.border} ${st.bg} mb-2 rounded-r-lg overflow-hidden text-sm transition-all cursor-pointer ${isSpotlighted ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-white dark:ring-offset-gray-900 spotlight-ring' : ''}`}
      style={{
        boxShadow: `-4px 0 12px -4px ${st.glow}`,
        transform: isHighlighted ? 'translateX(2px)' : 'none',
      }}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <div className="px-4 py-2.5">
        <div className="flex items-start gap-3">
          <span className={`font-mono font-bold text-base mt-px shrink-0 ${st.text}`}>
            {meta.openChar}
          </span>
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-gray-800 dark:text-gray-200">{meta.title}. </span>
            <span className="text-gray-500 dark:text-gray-400">{meta.desc}</span>
          </div>
        </div>
      </div>

      {isCharClass && node.children && node.children.length > 0 && (
        <div className="mx-4 mb-2 pl-3 border-l-2 border-gray-300/40 dark:border-gray-600/40 bg-gray-100/60 dark:bg-gray-800/40 py-2 px-3 rounded-r-md">
          <span className="font-mono text-gray-700 dark:text-gray-300 text-xs">
            {node.children
              .map((c) => {
                if (c.type === 'range') return c.value;
                return c.raw || c.value;
              })
              .join(', ')}
          </span>
        </div>
      )}

      {hasChildren && (
        <div className="pl-7 pr-3 pb-1 space-y-0">
          {node.children!.map((child, i) => (
            <ExplainNode
              key={i}
              node={child}
              hoveredNodeId={hoveredNodeId}
              onHoverNode={onHoverNode}
            />
          ))}
        </div>
      )}

      {meta.closeChar && (
        <div className="px-4 py-1 bg-black/[0.03] dark:bg-white/[0.02] border-t border-gray-200/50 dark:border-gray-700/30">
          <span className={`font-mono font-bold text-base ${st.text}`}>{meta.closeChar}</span>
        </div>
      )}
    </div>
  );
}

export function ExplanationPanel({
  ast,
  hoveredNodeId,
  onHoverNode,
  spotlightNodeIds,
  spotlightFirstNodeId,
}: ExplanationPanelProps) {
  const t = useT();
  const refs = useRef(new Map<string, HTMLDivElement>());
  const ctxValue = useMemo<SpotlightCtxValue>(
    () => ({
      ids: spotlightNodeIds ?? new Set(),
      registerRef: (id, el) => {
        if (el) refs.current.set(id, el);
        else refs.current.delete(id);
      },
    }),
    [spotlightNodeIds],
  );

  // Scroll the first spotlighted entry into view whenever it changes. We
  // wait one frame so refs have been registered by the freshly mounted nodes.
  useEffect(() => {
    if (!spotlightFirstNodeId) return;
    const id = spotlightFirstNodeId;
    const raf = requestAnimationFrame(() => {
      const el = refs.current.get(id);
      if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(raf);
  }, [spotlightFirstNodeId]);

  if (!ast || (ast.type === 'sequence' && (!ast.children || ast.children.length === 0))) {
    return (
      <div className="text-center py-10 text-gray-400 dark:text-gray-500 text-sm">
        {t.explain_empty()}
      </div>
    );
  }

  return (
    <SpotlightCtx.Provider value={ctxValue}>
      <div className="space-y-0 overflow-y-auto custom-scrollbar">
        <ExplainNode node={ast} hoveredNodeId={hoveredNodeId} onHoverNode={onHoverNode} />
      </div>
    </SpotlightCtx.Provider>
  );
}
