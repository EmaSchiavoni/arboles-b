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
  // Alto del nodo (de dónde sale la flecha). Por defecto NODE_HEIGHT.
  nodeHeight?: number;
  // Punto virtual a centrar en el contenedor al montar (una sola vez).
  initialCenter?: { x: number; y: number } | null;
  // Notifica cada cambio de vista (paneo/zoom) al padre.
  onViewChange?: (view: { x: number; y: number; k: number; w: number; h: number }) => void;
}

export function TreeCanvas<T extends CanvasNode>({ nodes, edges, renderNode, highlightIds, errorIds, linking, onBackgroundClick, extraSvg, getNodeWidth, getSlotX, nodeHeight, initialCenter, onViewChange }: Props<T>) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [pan, setPan] = React.useState({ x: 16, y: 16, k: 1 });
  const panRef = React.useRef(pan);
  const drag = React.useRef<{ sx: number; sy: number; px: number; py: number; active: boolean }>({ sx: 0, sy: 0, px: 0, py: 0, active: false });
  const pointers = React.useRef(new Map<number, { x: number; y: number; node: boolean }>());
  const pinchStart = React.useRef<{ d: number } | null>(null);

  const MIN_K = 0.25;
  const MAX_K = 3;
  const clampK = (k: number) => Math.min(MAX_K, Math.max(MIN_K, k));

  function applyPan(next: { x: number; y: number; k: number }) {
    panRef.current = next;
    setPan(next);
  }

  // Avisa al padre de cada cambio de vista (el callback guarda en ref,
  // no dispara renders, así que no hay riesgo de bucle). Incluye el tamaño
  // del contenedor para que el padre ubique nodos nuevos en el viewport.
  const lastNotified = React.useRef<{ x: number; y: number; k: number } | null>(null);
  const sizeRef = React.useRef({ w: 0, h: 0 });
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    function measure() {
      const r = el.getBoundingClientRect();
      sizeRef.current = { w: r.width, h: r.height };
    }
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  React.useEffect(() => {
    if (lastNotified.current === pan) return;
    lastNotified.current = pan;
    const s = sizeRef.current;
    onViewChange?.({ ...pan, w: s.w, h: s.h });
  });

  // Centrado inicial del punto virtual dado (una sola vez al montar).
  const didCenter = React.useRef(false);
  React.useEffect(() => {
    if (didCenter.current || !initialCenter) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    didCenter.current = true;
    applyPan({ x: r.width / 2 - initialCenter.x, y: r.height / 2 - initialCenter.y, k: 1 });
  }, [initialCenter]);

  // Zoom que mantiene fijo el punto (sx, sy) relativo al contenedor.
  function zoomAt(sx: number, sy: number, factor: number) {
    const cur = panRef.current;
    const k2 = clampK(cur.k * factor);
    if (k2 === cur.k) return;
    const r = k2 / cur.k;
    applyPan({ k: k2, x: sx - (sx - cur.x) * r, y: sy - (sy - cur.y) * r });
  }

  // Borrador del input de zoom: null = mostrar el valor real.
  const [zoomDraft, setZoomDraft] = React.useState<string | null>(null);
  const cancelBlur = React.useRef(false);

  // Indicador transitorio (mobile): se muestra 6 s desde el último cambio
  // de zoom, con debounce (cada cambio reinicia el conteo). En mobile el
  // indicador fijo queda detrás de la toolbar, así que se muestra debajo
  // de los botones flotantes superiores.
  const [flashZoom, setFlashZoom] = React.useState(false);
  const flashTimer = React.useRef<number | null>(null);
  const prevK = React.useRef(1);
  React.useEffect(() => {
    if (pan.k === prevK.current) return;
    prevK.current = pan.k;
    setFlashZoom(true);
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlashZoom(false), 6000);
  }, [pan.k]);
  React.useEffect(
    () => () => {
      if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    },
    [],
  );

  // Aplica el % escrito (centrado). Ante valor inválido o fuera de rango
  // (25-300) se vuelve al valor anterior.
  function commitZoom(raw: string) {
    if (cancelBlur.current) {
      cancelBlur.current = false;
      setZoomDraft(null);
      return;
    }
    const num = Number(raw.replace('%', '').trim());
    if (raw.trim() === '' || !Number.isFinite(num)) {
      setZoomDraft(null);
      return;
    }
    const target = Math.round(num);
    if (target < MIN_K * 100 || target > MAX_K * 100) {
      setZoomDraft(null);
      return;
    }
    const r = ref.current?.getBoundingClientRect();
    zoomAt(r ? r.width / 2 : 200, r ? r.height / 2 : 200, target / 100 / panRef.current.k);
    setZoomDraft(null);
  }

  function local(e: React.PointerEvent | { clientX: number; clientY: number }) {
    const r = ref.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  }

  function onPointerDown(e: React.PointerEvent) {
    const p = local(e);
    const inert = !!(e.target as HTMLElement).closest('[data-node],input,button');
    pointers.current.set(e.pointerId, { ...p, node: inert });
    if (pointers.current.size === 2) {
      // Pinch solo si ambos dedos están sobre el fondo (no sobre un nodo).
      const pts = [...pointers.current.values()];
      if (!pts.some((q) => q.node)) {
        const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        pinchStart.current = { d };
        drag.current.active = false;
      }
    }
    if (inert) return;
    document.getSelection()?.removeAllRanges();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // noop
    }
    const cur = panRef.current;
    drag.current = { sx: e.clientX, sy: e.clientY, px: cur.x, py: cur.y, active: pinchStart.current === null };
  }
  function onPointerMove(e: React.PointerEvent) {
    const m = pointers.current.get(e.pointerId);
    if (m) {
      const p = local(e);
      m.x = p.x;
      m.y = p.y;
    }
    const pts = [...pointers.current.values()];
    if (pinchStart.current && pointers.current.size === 2 && !pts.some((q) => q.node)) {
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const prev = pinchStart.current.d;
      if (d > 0 && prev > 0) {
        const mx = (pts[0].x + pts[1].x) / 2;
        const my = (pts[0].y + pts[1].y) / 2;
        zoomAt(mx, my, d / prev);
      }
      pinchStart.current = { d };
      return;
    }
    if (!drag.current.active) return;
    applyPan({ ...panRef.current, x: drag.current.px + (e.clientX - drag.current.sx), y: drag.current.py + (e.clientY - drag.current.sy) });
  }
  function endPointer(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
    if (pointers.current.size === 0) drag.current.active = false;
  }

  // Rueda: sin Ctrl mueve el canvas; con Ctrl (o Cmd) hace zoom sobre el cursor.
  // Listener no-pasivo para poder frenar el zoom de página del navegador.
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const target: HTMLDivElement = el;
    function onWheelNative(e: WheelEvent) {
      if (!e.ctrlKey && !e.metaKey) {
        const cur = panRef.current;
        const next = { ...cur, x: cur.x - e.deltaX * 0.5, y: cur.y - e.deltaY * 0.5 };
        panRef.current = next;
        setPan(next);
        return;
      }
      e.preventDefault();
      const r = target.getBoundingClientRect();
      const cur = panRef.current;
      const k2 = Math.min(MAX_K, Math.max(MIN_K, cur.k * Math.exp(-e.deltaY * 0.002)));
      if (k2 === cur.k) return;
      const sx = e.clientX - r.left;
      const sy = e.clientY - r.top;
      const ratio = k2 / cur.k;
      const next = { k: k2, x: sx - (sx - cur.x) * ratio, y: sy - (sy - cur.y) * ratio };
      panRef.current = next;
      setPan(next);
    }
    target.addEventListener('wheel', onWheelNative, { passive: false });
    return () => target.removeEventListener('wheel', onWheelNative);
  }, []);

  // Teclado: Ctrl/Cmd + (+/-) zoom centrado, Ctrl/Cmd + 0 restablece.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key !== '+' && e.key !== '=' && e.key !== '-' && e.key !== '0') return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      const r = ref.current?.getBoundingClientRect();
      zoomAt(r ? r.width / 2 : 200, r ? r.height / 2 : 200, e.key === '-' ? 1 / 1.25 : e.key === '0' ? 1 / panRef.current.k : 1.25);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const byId = React.useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const widthOf = getNodeWidth ?? nodeWidth;
  const heightOf = nodeHeight ?? NODE_HEIGHT;
  const contentW = Math.max(600, ...nodes.map((n) => n.x + widthOf(n.keys.length) + 80));
  const contentH = Math.max(400, ...nodes.map((n) => n.y + heightOf + 120));

  function edgePath(from: T, to: T, slot: number): string {
    const fw = widthOf(from.keys.length);
    const slotCount = from.keys.length + 1;
    const x1 = getSlotX ? getSlotX(from, slot) : from.x + ((slot + 0.5) / Math.max(1, slotCount)) * fw;
    const y1 = from.y + heightOf;
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
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-node],input,button')) return;
        onBackgroundClick?.();
      }}
      className={cn(
        'relative h-full w-full touch-none select-none overflow-hidden bg-white dark:bg-zinc-950',
        linking && 'ring-1 ring-inset ring-zinc-500',
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
            // La flecha se resalta solo si ambos extremos pertenecen al camino
            // (si solo el origen está marcado, sus otras flechas quedan normal).
            const hot = !!highlightIds?.has(e.from) && !!highlightIds?.has(e.to);
            const bad = errorIds?.has(e.from) || errorIds?.has(e.to);
            return (
              <path
                key={`${e.from}-${e.to}-${i}`}
                d={edgePath(f, t, e.slot)}
                fill="none"
                strokeWidth={hot ? 2.5 : 1.5}
                className={bad ? 'stroke-red-500 dark:stroke-red-400' : hot ? 'stroke-zinc-900 dark:stroke-zinc-100' : 'stroke-zinc-400 dark:stroke-zinc-500'}
                markerEnd="url(#arrow)"
              />
            );
          })}
          <defs>
            <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6" fill="none" strokeWidth="1.2" className="stroke-zinc-500 dark:stroke-zinc-400" />
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
      <span
        title="Zoom actual en % (Enter para aplicar, Esc para cancelar)"
        className="absolute bottom-2 right-2 z-10 hidden items-center gap-0.5 rounded-full border bg-card/95 px-2 py-0.5 text-[11px] text-muted-foreground shadow-sm backdrop-blur sm:flex"
      >
        <input
          value={zoomDraft ?? String(Math.round(pan.k * 100))}
          onChange={(e) => setZoomDraft(e.target.value)}
          onBlur={(e) => commitZoom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            else if (e.key === 'Escape') {
              cancelBlur.current = true;
              (e.target as HTMLInputElement).blur();
            }
          }}
          inputMode="numeric"
          aria-label="Nivel de zoom en porcentaje"
          className="w-9 select-text bg-transparent text-center tabular-nums focus:outline-none"
        />
        <span>%</span>
      </span>
      {flashZoom && (
        <div className="fixed right-3 top-[60px] z-40 rounded-full border bg-card/95 px-2.5 py-1 text-xs tabular-nums text-muted-foreground shadow-lg backdrop-blur sm:hidden">
          {Math.round(pan.k * 100)} %
        </div>
      )}
    </div>
  );
}
