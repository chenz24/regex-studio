import { useState, useCallback, useEffect, useRef } from 'react';
import { Maximize2, Minimize2, Pencil, Undo2, Redo2 } from 'lucide-react';
import { RailroadDiagram } from './RailroadDiagram';
import { NodeEditor } from './NodeEditor';
import { findNodeById } from '../../utils/patternEditor';
import { useRegexStore } from '../../stores/regexStore';
import type { ASTNode } from '../../types/regex';
import type { LayoutResult } from '../../utils/diagramLayout';
import { useT } from '@/lib/i18n';

function findNodeByRange(root: ASTNode, start: number, end: number): ASTNode | null {
  if (root.start === start && root.end === end) return root;
  for (const child of root.children || []) {
    const found = findNodeByRange(child, start, end);
    if (found) return found;
  }
  return null;
}

function findNodeAtStart(root: ASTNode, start: number): ASTNode | null {
  let best: ASTNode | null = null;
  const walk = (n: ASTNode) => {
    if (n.start === start) {
      if (!best || n.end - n.start < best.end - best.start) best = n;
    }
    for (const c of n.children || []) walk(c);
  };
  walk(root);
  return best;
}

interface RailroadBannerProps {
  diagram: LayoutResult;
  ast: ASTNode;
  pattern: string;
  onPatternChange: (pattern: string) => void;
  hoveredNodeId: string | null;
  onHoverNode: (id: string | null) => void;
  /** Tutorial spotlight node ids — forwarded to RailroadDiagram. */
  spotlightNodeIds?: Set<string>;
}

export function RailroadBanner({
  diagram,
  ast,
  pattern,
  onPatternChange,
  hoveredNodeId,
  onHoverNode,
  spotlightNodeIds,
}: RailroadBannerProps) {
  const t = useT();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const pendingAnchorRef = useRef<{ start: number; end: number } | null>(null);

  const undoPattern = useRegexStore((s) => s.undoPattern);
  const redoPattern = useRegexStore((s) => s.redoPattern);
  const canUndo = useRegexStore((s) => s.patternPast.length > 0);
  const canRedo = useRegexStore((s) => s.patternFuture.length > 0);

  const handleSelectNode = useCallback((id: string | null) => {
    setSelectedNodeId(id);
    // Auto-expand when a node is selected for editing
    if (id) setExpanded(true);
  }, []);

  const handleCloseEditor = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  // Wrap onPatternChange to record an anchor so we can migrate selection
  // after the AST re-parses (node ids change every parse).
  const handleEditPatternChange = useCallback(
    (newPattern: string) => {
      if (selectedNodeId) {
        const current = findNodeById(ast, selectedNodeId);
        if (current) {
          pendingAnchorRef.current = { start: current.start, end: current.end };
        }
      }
      onPatternChange(newPattern);
    },
    [ast, selectedNodeId, onPatternChange],
  );

  useEffect(() => {
    const anchor = pendingAnchorRef.current;
    if (!anchor) return;
    pendingAnchorRef.current = null;
    const exact = findNodeByRange(ast, anchor.start, anchor.end);
    if (exact) {
      setSelectedNodeId(exact.id);
      return;
    }
    const sameStart = findNodeAtStart(ast, anchor.start);
    if (sameStart) {
      setSelectedNodeId(sameStart.id);
      return;
    }
    setSelectedNodeId(null);
  }, [ast]);

  // Global keyboard shortcuts: Cmd/Ctrl+Z = undo, Cmd/Ctrl+Shift+Z or Ctrl+Y = redo.
  // Skip when focus is in an input/textarea/contenteditable (preserve native undo).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return;
      }
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undoPattern();
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault();
        redoPattern();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undoPattern, redoPattern]);

  const isEditing = selectedNodeId !== null;
  const maxHeight = expanded || isEditing ? 800 : 160;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700/80 bg-white dark:bg-gray-900/60 overflow-hidden shadow-sm transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700/80">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
            {t.railroad_title()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500">
            <Pencil className="w-3 h-3" />
            {t.railroad_click_to_edit()}
          </span>
          <div className="flex items-center gap-0.5">
            <button
              onClick={undoPattern}
              disabled={!canUndo}
              className="p-1 rounded-md text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              title={t.railroad_undo()}
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={redoPattern}
              disabled={!canRedo}
              className="p-1 rounded-md text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              title={t.railroad_redo()}
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            onClick={() => {
              setExpanded(!expanded);
              if (!expanded === false) setSelectedNodeId(null);
            }}
            className="p-1 rounded-md text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title={expanded ? t.railroad_collapse() : t.railroad_expand()}
          >
            {expanded ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex transition-all duration-300" style={{ maxHeight, minHeight: 220 }}>
        {/* Diagram area */}
        <div
          className="relative overflow-auto custom-scrollbar flex-1"
          style={{
            backgroundImage: 'radial-gradient(circle, var(--dot-color) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        >
          <div className="p-4">
            <RailroadDiagram
              layout={diagram}
              hoveredNodeId={hoveredNodeId}
              onHoverNode={onHoverNode}
              selectedNodeId={selectedNodeId}
              onSelectNode={handleSelectNode}
              spotlightNodeIds={spotlightNodeIds}
            />
          </div>
        </div>

        {/* Node Editor (slides in when editing) */}
        {isEditing && (
          <div className="w-72 shrink-0 overflow-y-auto custom-scrollbar">
            <NodeEditor
              ast={ast}
              selectedNodeId={selectedNodeId}
              pattern={pattern}
              onPatternChange={handleEditPatternChange}
              onClose={handleCloseEditor}
            />
          </div>
        )}
      </div>
    </div>
  );
}
