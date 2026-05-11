import { useRef, useState, useEffect, useCallback } from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import type {
  LayoutResult,
  DrawRect,
  DrawText,
  DrawPath,
  DrawBadge,
} from '../../utils/diagramLayout';
import { useT } from '@/lib/i18n';

interface RailroadDiagramProps {
  layout: LayoutResult;
  hoveredNodeId: string | null;
  onHoverNode: (id: string | null) => void;
  selectedNodeId?: string | null;
  onSelectNode?: (id: string | null) => void;
  /**
   * Tutorial spotlight — a set of AST node ids to draw an amber pulsing
   * ring around. Drawn on top of the hover / selected rings.
   */
  spotlightNodeIds?: Set<string>;
}

const FONT = "'DejaVu Sans Mono', 'SF Mono', 'Fira Code', monospace";

function PathElement({ p, isDark }: { p: DrawPath; isDark: boolean }) {
  if (!p.d || p.strokeWidth === 0) return null;
  return (
    <path
      d={p.d}
      fill="none"
      stroke={isDark ? p.darkStroke : p.stroke}
      strokeWidth={p.strokeWidth}
      strokeDasharray={p.strokeDash}
      strokeLinecap={(p.strokeLinecap || 'round') as 'round'}
      strokeLinejoin={(p.strokeLinejoin || 'round') as 'round'}
      markerEnd={p.markerEnd}
    />
  );
}

function RectElement({
  r,
  isDark,
  isHovered,
  isSelected,
  isSpotlighted,
  onEnter,
  onLeave,
  onClick,
}: {
  r: DrawRect;
  isDark: boolean;
  isHovered: boolean;
  isSelected: boolean;
  isSpotlighted: boolean;
  onEnter: () => void;
  onLeave: () => void;
  onClick: () => void;
}) {
  const fill = isDark ? r.darkFill : r.fill;
  const stroke = isDark ? r.darkStroke : r.stroke;
  const hoverStroke = isHovered ? (isDark ? '#2dd4bf' : '#14b8a6') : undefined;

  return (
    <g
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={onClick}
      style={{ cursor: r.nodeId ? 'pointer' : undefined }}
    >
      <rect
        x={r.x}
        y={r.y}
        width={r.w}
        height={r.h}
        rx={r.rx}
        fill={fill}
        stroke={hoverStroke || (stroke === 'none' ? undefined : stroke)}
        strokeWidth={hoverStroke ? 2.5 : stroke === 'none' ? 0 : 2}
        strokeDasharray={hoverStroke ? undefined : r.strokeDash}
        style={{ transition: 'stroke 0.15s' }}
      />
      {isSelected && (
        <rect
          x={r.x - 3}
          y={r.y - 3}
          width={r.w + 6}
          height={r.h + 6}
          rx={r.rx + 3}
          fill="none"
          stroke={isDark ? '#2dd4bf' : '#14b8a6'}
          strokeWidth={2.5}
        />
      )}
      {isSpotlighted && (
        <rect
          x={r.x - 4}
          y={r.y - 4}
          width={r.w + 8}
          height={r.h + 8}
          rx={r.rx + 4}
          fill="none"
          stroke={isDark ? '#fbbf24' : '#f59e0b'}
          strokeWidth={3}
          className="spotlight-ring"
        />
      )}
    </g>
  );
}

function TextElement({ t, isDark }: { t: DrawText; isDark: boolean }) {
  return (
    <text
      x={t.x}
      y={t.y}
      textAnchor={t.anchor}
      dominantBaseline={t.anchor === 'middle' ? 'central' : 'auto'}
      fontSize={t.fontSize}
      fontFamily={FONT}
      fontWeight={t.fontWeight}
      fill={isDark ? t.darkFill : t.fill}
      style={{ pointerEvents: 'none' }}
    >
      {t.text}
    </text>
  );
}

function BadgeElement({
  b,
  isDark,
  isHovered,
  isSelected,
  isSpotlighted,
  onEnter,
  onLeave,
  onClick,
}: {
  b: DrawBadge;
  isDark: boolean;
  isHovered: boolean;
  isSelected: boolean;
  isSpotlighted: boolean;
  onEnter: () => void;
  onLeave: () => void;
  onClick: () => void;
}) {
  const clickable = !!b.nodeId;
  // Approximate hit-area around the badge text (centered at b.x, baseline ~b.y+12)
  const halfW = Math.max(18, b.text.length * 4 + 6);
  const hitX = b.x - halfW;
  const hitY = b.y + 1;
  const hitW = halfW * 2;
  const hitH = 18;
  const accent = isDark ? '#2dd4bf' : '#14b8a6';
  return (
    <g
      onMouseEnter={clickable ? onEnter : undefined}
      onMouseLeave={clickable ? onLeave : undefined}
      onClick={clickable ? onClick : undefined}
      style={{ cursor: clickable ? 'pointer' : undefined }}
    >
      {isSpotlighted && (
        <rect
          x={hitX - 2}
          y={hitY - 2}
          width={hitW + 4}
          height={hitH + 4}
          rx={6}
          fill="none"
          stroke={isDark ? '#fbbf24' : '#f59e0b'}
          strokeWidth={2.5}
          className="spotlight-ring"
        />
      )}
      {clickable && (
        <rect
          x={hitX}
          y={hitY}
          width={hitW}
          height={hitH}
          rx={4}
          fill={
            isSelected
              ? isDark
                ? 'rgba(45,212,191,0.18)'
                : 'rgba(20,184,166,0.12)'
              : 'transparent'
          }
          stroke={isSelected || isHovered ? accent : 'transparent'}
          strokeWidth={isSelected ? 2 : isHovered ? 1.5 : 0}
          strokeDasharray={isSelected ? undefined : '3 2'}
          style={{ transition: 'stroke 0.15s, fill 0.15s' }}
        />
      )}
      <text
        x={b.x}
        y={b.y + 12}
        textAnchor="middle"
        fontSize={11}
        fontFamily={FONT}
        fontWeight={500}
        fill={isHovered || isSelected ? accent : isDark ? b.darkTextColor : b.textColor}
        style={{ pointerEvents: 'none' }}
      >
        {b.text.split(/(∞)/).map((part, idx) =>
          part === '∞' ? (
            <tspan key={idx} fontSize={16} dy="1" fontWeight={600}>
              {part}
            </tspan>
          ) : (
            <tspan key={idx}>{part}</tspan>
          ),
        )}
      </text>
    </g>
  );
}

export function RailroadDiagram({
  layout,
  hoveredNodeId,
  onHoverNode,
  selectedNodeId,
  onSelectNode,
  spotlightNodeIds,
}: RailroadDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [isDark, setIsDark] = useState(false);
  const t = useT();

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains('dark'));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const handleNodeEnter = useCallback(
    (nodeId: string | undefined) => {
      if (nodeId) onHoverNode(nodeId);
    },
    [onHoverNode],
  );

  const handleNodeLeave = useCallback(() => {
    onHoverNode(null);
  }, [onHoverNode]);

  const handleNodeClick = useCallback(
    (nodeId: string | undefined) => {
      if (onSelectNode && nodeId) {
        onSelectNode(selectedNodeId === nodeId ? null : nodeId);
      }
    },
    [onSelectNode, selectedNodeId],
  );

  if (layout.nodes.length === 0 && layout.paths.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-400 dark:bg-emerald-500" />
          <div className="w-24 h-0.5 bg-gray-300 dark:bg-gray-600" />
          <div className="w-10 h-10 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center">
            <span className="text-gray-300 dark:text-gray-600 text-lg font-bold">?</span>
          </div>
          <div className="w-24 h-0.5 bg-gray-300 dark:bg-gray-600" />
          <div className="w-3 h-3 rounded-full border-2 border-gray-300 dark:border-gray-600" />
        </div>
        <p className="text-sm text-gray-400 dark:text-gray-500">
          {t.railroad_empty_hint()}
        </p>
      </div>
    );
  }

  const containers = layout.nodes.filter((r) => r.layer === 'container');
  const nodes = layout.nodes.filter((r) => r.layer === 'node');
  const labels = layout.texts.filter((t) => t.layer === 'label');
  const nodeTexts = layout.texts.filter((t) => t.layer === 'node');

  return (
    <div className="relative">
      <div className="absolute top-0 right-0 z-10 flex items-center gap-1 bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm rounded-lg p-0.5 border border-gray-200/50 dark:border-gray-700/50">
        <button
          onClick={() => setZoom((z) => Math.max(z - 0.15, 0.3))}
          className="p-1.5 rounded text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500 min-w-[32px] text-center select-none">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom((z) => Math.min(z + 0.15, 2.5))}
          className="p-1.5 rounded text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setZoom(1)}
          className="p-1.5 rounded text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div ref={containerRef} className="overflow-x-auto overflow-y-hidden custom-scrollbar">
        <svg
          width={layout.width * zoom}
          height={layout.height * zoom}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          className="select-none"
        >
          <defs>
            <radialGradient id="startGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#eeffee" />
              <stop offset="100%" stopColor="#008000" />
            </radialGradient>
            <radialGradient id="startGradDark" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#6ee7b7" />
              <stop offset="100%" stopColor="#059669" />
            </radialGradient>
            <radialGradient id="endGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#000000" />
            </radialGradient>
            <radialGradient id="endGradDark" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#e2e8f0" />
              <stop offset="100%" stopColor="#334155" />
            </radialGradient>
          </defs>

          <g id="wires">
            {layout.paths.map((p, i) => (
              <PathElement key={i} p={p} isDark={isDark} />
            ))}
          </g>

          <g id="containers">
            {containers.map((r, i) => (
              <RectElement
                key={`c-${i}`}
                r={r}
                isDark={isDark}
                isHovered={!!r.nodeId && r.nodeId === hoveredNodeId}
                isSelected={!!r.nodeId && r.nodeId === selectedNodeId}
                isSpotlighted={!!r.nodeId && !!spotlightNodeIds?.has(r.nodeId)}
                onEnter={() => handleNodeEnter(r.nodeId)}
                onLeave={handleNodeLeave}
                onClick={() => handleNodeClick(r.nodeId)}
              />
            ))}
          </g>

          <g id="nodes">
            {nodes.map((r, i) => (
              <RectElement
                key={`n-${i}`}
                r={r}
                isDark={isDark}
                isHovered={!!r.nodeId && r.nodeId === hoveredNodeId}
                isSelected={!!r.nodeId && r.nodeId === selectedNodeId}
                isSpotlighted={!!r.nodeId && !!spotlightNodeIds?.has(r.nodeId)}
                onEnter={() => handleNodeEnter(r.nodeId)}
                onLeave={handleNodeLeave}
                onClick={() => handleNodeClick(r.nodeId)}
              />
            ))}
            {nodeTexts.map((t, i) => (
              <TextElement key={`nt-${i}`} t={t} isDark={isDark} />
            ))}
          </g>

          <g id="badges">
            {layout.badges.map((b, i) => (
              <BadgeElement
                key={`b-${i}`}
                b={b}
                isDark={isDark}
                isHovered={!!b.nodeId && b.nodeId === hoveredNodeId}
                isSelected={!!b.nodeId && b.nodeId === selectedNodeId}
                isSpotlighted={!!b.nodeId && !!spotlightNodeIds?.has(b.nodeId)}
                onEnter={() => handleNodeEnter(b.nodeId)}
                onLeave={handleNodeLeave}
                onClick={() => handleNodeClick(b.nodeId)}
              />
            ))}
          </g>

          <g id="labels">
            {labels.map((t, i) => (
              <TextElement key={`l-${i}`} t={t} isDark={isDark} />
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
}
