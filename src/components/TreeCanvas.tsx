import * as React from 'react';
import { cn } from '../lib/utils';

export interface CanvasNode {
  id: string;
  keys: number[];
  x: number;
  y: number;
}

export interface CanvasEdge {
  from: string;
  to: string;
  slot: number;
}

export function nodeWidth(keysCount: number): number {
  return Math.max(96, keysCount * 40 + 48);
}
export const NODE_HEIGHT = 64;

interface Props<T extends CanvasNode> {
  nodes: T[];
  edges: CanvasEdge[];
  renderNode: (n: T) => React.ReactNode;
  highlightIds?: Set<string>;
  errorIds?: Set<string>;
  linking?: boolean;
  onBackgroundClick?: () => void;
  extraSvg?: React.ReactNode;
  // Geometría opcional: ancho del nodo según cantidad de claves y coordenada
  // x absoluta del ancla de cada slot de salida (inicio de la flecha).
  getNodeWidth?: (keysCount: number) => number;
  getSlotX?: (node: T, slot: number) => number;
}

export function TreeCanvas<T extends CanvasNode>({ nodes, edges, renderNode, highlightIds, errorIds, linking, onBackgroundClick, extraSvg, getNodeWidth, getSlotX }: Props<T>) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [pan, setPan] = React.useState({ x: 16, y: 16, k: 1 });
  const drag = React.useRef<{ sx: number; sy: number; px: number; py: number; active: boolean }>({ sx: 0, sy: 0, px: 0, py: 0, active: false });

  const byId = React.useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  function onPointerDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest('[data-node]')) return;
    drag.current = { sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y, active: true };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current.active) return;
    setPan((p) => ({ ...p, x: drag.current.px + (e.clientX - drag.current.sx), y: drag.current.py + (e.clientY - drag.current.sy) }));
  }
  function onPointerUp() {
    drag.current.active = false;
  }

  function onWheel(e: React.WheelEvent) {
    if (!e.ctrlKey && Math.abs(e.deltaY) < 60 && e.deltaX === 0) {
      // scroll vertical normal del contenedor: lo dejamos pasar
    }
    setPan((p) => ({ ...p, y: p.y - e.deltaY * 0.5, x: p.x - e.deltaX * 0.5 }));
  }

  const widthOf = getNodeWidth ?? nodeWidth;
  const contentW = Math.max(600, ...nodes.map((n) => n.x + widthOf(n.keys.length) + 80));
  const contentH = Math.max(400, ...nodes.map((n) => n.y + NODE_HEIGHT + 120));

  function edgePath(from: T, to: T, slot: number): string {
    const fw = widthOf(from.keys.length);
    const slotCount = from.keys.length + 1;
    const x1 = getSlotX ? getSlotX(from, slot) : from.x + ((slot + 0.5) / Math.max(1, slotCount)) * fw;
    const y1 = from.y + NODE_HEIGHT;
    const tw = widthOf(to.keys.length);
    const x2 = to.x + tw / 2;
    const y2 = to.y;
    const mid = (y1 + y2) / 2;
    return `M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`;
  }

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onWheel={onWheel}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-node]')) return;
        onBackgroundClick?.();
      }}
      className={cn(
        'relative h-[62vh] w-full touch-none overflow-hidden rounded-md border bg-white sm:h-[68vh] dark:bg-zinc-950',
        linking && 'ring-1 ring-zinc-500',
      )}
    >
      <div
        className="absolute left-0 top-0"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${pan.k})`, transformOrigin: '0 0', width: contentW, height: contentH }}
      >
        <svg width={contentW} height={contentH} className="absolute left-0 top-0 overflow-visible">
          {edges.map((e, i) => {
            const f = byId.get(e.from);
            const t = byId.get(e.to);
            if (!f || !t) return null;
            const hot = highlightIds?.has(e.from) || highlightIds?.has(e.to);
            const bad = errorIds?.has(e.from) || errorIds?.has(e.to);
            return (
              <path
                key={`${e.from}-${e.to}-${i}`}
                d={edgePath(f, t, e.slot)}
                fill="none"
                strokeWidth={hot ? 2.5 : 1.5}
                className={bad ? 'stroke-red-500' : hot ? 'stroke-zinc-900 dark:stroke-zinc-100' : 'stroke-zinc-400 dark:stroke-zinc-600'}
                markerEnd="url(#arrow)"
              />
            );
          })}
          <defs>
            <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6" fill="none" strokeWidth="1.2" className="stroke-zinc-500" />
            </marker>
          </defs>
          {extraSvg}
        </svg>
        {nodes.map((n) => (
          <div key={n.id} className="absolute" style={{ left: n.x, top: n.y, width: widthOf(n.keys.length) }}>
            {renderNode(n)}
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-zinc-900/80 px-2 py-0.5 text-[11px] text-zinc-100 dark:bg-zinc-100/90 dark:text-zinc-900">
        Arrastrá el fondo para mover · {nodes.length} nodos
      </div>
    </div>
  );
}
