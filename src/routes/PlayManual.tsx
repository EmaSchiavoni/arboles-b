import * as React from 'react';
import { ArrowDownToLine, Crown, GripVertical, Plus, Trash2, X, ShieldCheck, Eraser } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import { Sheet } from '../components/ui/sheet';
import { BottomToolbar } from '../components/BottomToolbar';
import { TreeCanvas } from '../components/TreeCanvas';
import { validateManualTree, type ManualNode, type ValidationResult } from '../lib/validate';
import { KEYS, load, save } from '../lib/storage';
import { cn } from '../lib/utils';

const MIN_P = 3;
const MAX_P = 8;

// Tabla completa siempre visible: p columnas de puntero (delgadas) + p-1
// celdas de clave, una al lado de otra (nodo lleno: 2p-1 columnas). La columna
// de puntero solo aloja el inicio de la flecha. Las celdas de clave vacías se
// editan directo; solo los primeros |claves|+1 slots aceptan punteros.
const SLOT_COL_W = 30;
const KEY_COL_W = 64;

function manualNodeWidth(p: number): number {
  return Math.max(150, p * SLOT_COL_W + (p - 1) * KEY_COL_W);
}

// Coordenada x absoluta del centro de la columna del slot (para la flecha).
function manualSlotX(x: number, p: number, slot: number): number {
  const w = manualNodeWidth(p);
  const keyW = (w - p * SLOT_COL_W) / (p - 1);
  return x + slot * (SLOT_COL_W + keyW) + SLOT_COL_W / 2;
}

function uid(): string {
  return `m${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

interface Draft {
  nodes: ManualNode[];
  rootId: string | null;
  p: number;
}

function seed(): Draft {
  const a: ManualNode = { id: uid(), keys: [10, 20], slots: [null, null, null], x: 60, y: 20 };
  const b: ManualNode = { id: uid(), keys: [5], slots: [null, null], x: 0, y: 220 };
  const c: ManualNode = { id: uid(), keys: [15], slots: [null, null], x: 220, y: 220 };
  a.slots = [b.id, c.id, null];
  return { nodes: [a, b, c], rootId: a.id, p: 4 };
}

function fixSlots(keys: number[], slots: (string | null)[]): (string | null)[] {
  const need = keys.length + 1;
  const next = slots.slice(0, need);
  while (next.length < need) next.push(null);
  return next;
}

export function PlayManual() {
  const [draft, setDraft] = React.useState<Draft>(() => {
    const saved = load<Draft | null>(KEYS.manual, null);
    if (saved && Array.isArray(saved.nodes)) return { ...saved, p: Math.min(MAX_P, Math.max(MIN_P, saved.p || 4)) };
    return seed();
  });
  const [linking, setLinking] = React.useState<{ nodeId: string; slot: number } | null>(null);
  const [result, setResult] = React.useState<ValidationResult | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const dragRef = React.useRef<{ id: string; dx: number; dy: number } | null>(null);

  const { nodes, rootId, p } = draft;

  React.useEffect(() => {
    save(KEYS.manual, draft);
  }, [draft]);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setLinking(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const errorIds = React.useMemo(() => new Set((result?.issues ?? []).map((i) => i.nodeId).filter(Boolean) as string[]), [result]);

  const edges = React.useMemo(
    () => nodes.flatMap((n) => n.slots.map((t, slot) => (t ? { from: n.id, to: t, slot } : null)).filter(Boolean) as { from: string; to: string; slot: number }[]),
    [nodes],
  );

  function update(fn: (d: Draft) => Draft) {
    setDraft((d) => fn(structuredClone(d)));
    setResult(null);
    setSheetOpen(false);
  }

  function addNode() {
    update((d) => {
      const n: ManualNode = {
        id: uid(),
        keys: [],
        slots: [null],
        x: 40 + (d.nodes.length % 4) * 160,
        y: 40 + Math.floor(d.nodes.length / 4) * 180,
      };
      d.nodes.push(n);
      if (!d.rootId) d.rootId = n.id;
      return d;
    });
  }

  function deleteNode(id: string) {
    update((d) => {
      d.nodes = d.nodes.filter((n) => n.id !== id);
      for (const n of d.nodes) n.slots = n.slots.map((s) => (s === id ? null : s));
      if (d.rootId === id) d.rootId = d.nodes[0]?.id ?? null;
      return d;
    });
    if (linking?.nodeId === id) setLinking(null);
  }

  function setRoot(id: string) {
    update((d) => ({ ...d, rootId: id }));
  }

  function addKey(id: string, raw: string) {
    const v = Number(raw.trim());
    if (raw.trim() === '' || !Number.isInteger(v)) return;
    const n = nodes.find((x) => x.id === id);
    if (!n || n.keys.includes(v) || n.keys.length >= p - 1) return;
    update((d) => {
      const t = d.nodes.find((x) => x.id === id);
      if (!t || t.keys.includes(v) || t.keys.length >= d.p - 1) return d;
      t.keys = [...t.keys, v];
      t.slots = fixSlots(t.keys, t.slots);
      return d;
    });
  }

  // Lleva el foco a la primera celda de clave vacía del nodo.
  function focusEmptyKey(id: string) {
    const el = document.querySelector<HTMLInputElement>(`input[data-empty-cell="${id}"]`);
    el?.focus();
  }

  function removeKey(id: string, index: number) {
    update((d) => {
      const n = d.nodes.find((x) => x.id === id);
      if (!n) return d;
      n.keys.splice(index, 1);
      n.slots = fixSlots(n.keys, n.slots);
      return d;
    });
  }

  function editKey(id: string, index: number, raw: string) {
    const v = Number(raw);
    if (raw.trim() === '' || !Number.isInteger(v)) return;
    update((d) => {
      const n = d.nodes.find((x) => x.id === id);
      if (!n) return d;
      n.keys[index] = v;
      return d;
    });
  }

  function startLink(nodeId: string, slot: number) {
    setLinking({ nodeId, slot });
  }

  function completeLink(targetId: string) {
    if (!linking) return;
    if (targetId === linking.nodeId) return;
    const { nodeId, slot } = linking;
    update((d) => {
      const n = d.nodes.find((x) => x.id === nodeId);
      if (n) {
        n.slots = fixSlots(n.keys, n.slots);
        n.slots[slot] = targetId;
      }
      return d;
    });
    setLinking(null);
  }

  function removeLink(nodeId: string, slot: number) {
    update((d) => {
      const n = d.nodes.find((x) => x.id === nodeId);
      if (n) n.slots[slot] = null;
      return d;
    });
  }

  function doValidate() {
    setResult(validateManualTree(nodes, p, rootId));
    setSheetOpen(true);
  }

  function doClear() {
    setDraft((d) => ({ ...d, nodes: [], rootId: null }));
    setResult(null);
    setSheetOpen(false);
    setLinking(null);
  }

  function onNodePointerDown(e: React.PointerEvent, id: string) {
    const n = nodes.find((x) => x.id === id);
    if (!n) return;
    dragRef.current = { id, dx: e.clientX - n.x, dy: e.clientY - n.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onNodePointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    const nx = e.clientX - d.dx;
    const ny = e.clientY - d.dy;
    setDraft((prev) => ({ ...prev, nodes: prev.nodes.map((n) => (n.id === d.id ? { ...n, x: Math.max(0, nx), y: Math.max(0, ny) } : n)) }));
  }
  function onNodePointerUp() {
    dragRef.current = null;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex max-w-[calc(100vw-190px)] shrink-0 flex-wrap items-center gap-2 px-3 pt-2">
        <Badge>orden p = {p}</Badge>
        <Badge variant="secondary">máx {p - 1} claves</Badge>
        <Badge variant="secondary">mín {Math.ceil(p / 2) - 1} claves · {Math.ceil(p / 2)} punteros</Badge>
        {rootId ? <Badge variant="outline">raíz elegida</Badge> : <Badge variant="error">sin raíz</Badge>}
        {result && (result.valid ? <Badge variant="ok">válido</Badge> : <Badge variant="error">{result.issues.length} errores</Badge>)}
      </div>

      <div className="flex shrink-0 items-center gap-2 px-3 py-2">
        <label htmlFor="orden-manual" className="text-sm text-muted-foreground">Orden p ({MIN_P}–{MAX_P})</label>
        <input
          id="orden-manual"
          type="range"
          min={MIN_P}
          max={MAX_P}
          value={p}
          onChange={(e) => { setDraft((d) => ({ ...d, p: Number(e.target.value) })); setResult(null); }}
          className="h-2 w-40 accent-zinc-900 dark:accent-zinc-100"
        />
        <span className="text-sm font-medium">{p}</span>
      </div>

      {nodes.length === 0 ? (
        <div className="min-h-0 flex-1 p-3">
          <Card className="mb-3">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No hay nodos. Creá el primero con el botón de la barra inferior.
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="relative min-h-0 flex-1">
          <TreeCanvas
          nodes={nodes}
          edges={edges}
          linking={!!linking}
          errorIds={errorIds}
          onBackgroundClick={() => setLinking(null)}
          getNodeWidth={() => manualNodeWidth(p)}
          getSlotX={(node, slot) => manualSlotX(node.x, p, slot)}
          renderNode={(n) => {
            const isRoot = n.id === rootId;
            const isTarget = !!linking && linking.nodeId !== n.id;
            const bad = errorIds.has(n.id);
            const full = n.keys.length >= p - 1;
            const cols: string[] = [];
            for (let s = 0; s < p; s += 1) {
              cols.push(`${SLOT_COL_W}px`);
              if (s < p - 1) cols.push('minmax(0,1fr)');
            }
            return (
              <div
                data-node
                className={cn(
                  'rounded-md border bg-card shadow-sm',
                  bad ? 'border-red-500 ring-1 ring-red-500' : isRoot ? 'border-zinc-900 dark:border-zinc-100' : 'border-border',
                  isTarget && 'ring-2 ring-dashed ring-zinc-500',
                )}
              >
                <div
                  className="flex h-6 cursor-grab touch-none items-center gap-1 border-b px-1 text-muted-foreground active:cursor-grabbing"
                  onPointerDown={(e) => {
                    if ((e.target as HTMLElement).closest('input,button')) return;
                    onNodePointerDown(e, n.id);
                  }}
                  onPointerMove={onNodePointerMove}
                  onPointerUp={onNodePointerUp}
                >
                  <GripVertical className="size-3.5 shrink-0" />
                  {isRoot ? (
                    <span className="min-w-0 flex-1 truncate text-center text-[10px]">raíz</span>
                  ) : (
                    <span className="min-w-0 flex-1" />
                  )}
                  {!full && (
                    <button type="button" title="Ir a la primera celda vacía" onClick={() => focusEmptyKey(n.id)} className="shrink-0 rounded-full p-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                      <Plus className="size-3" />
                    </button>
                  )}
                  {!isRoot && (
                    <button type="button" title="Marcar como raíz" onClick={() => setRoot(n.id)} className="shrink-0 rounded-full p-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                      <Crown className="size-3" />
                    </button>
                  )}
                  <button type="button" title="Eliminar nodo" onClick={() => deleteNode(n.id)} className="shrink-0 rounded-full p-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                    <Trash2 className="size-3" />
                  </button>
                </div>

                <div className="grid h-10 w-full" style={{ gridTemplateColumns: cols.join(' ') }}>
                  {Array.from({ length: p }, (_, slot) => {
                    const live = slot <= n.keys.length; // slots existentes: |claves|+1
                    const linked = live ? n.slots[slot] : null;
                    return (
                      <span key={`cells-${slot}`} className="contents">
                        <span className={cn('flex items-center justify-center', slot > 0 && 'border-l border-border')}>
                          {!live ? (
                            <span className="size-1.5 rounded-full border border-zinc-300 dark:border-zinc-700" title={`Puntero ${slot} (se habilita al agregar claves)`} />
                          ) : linked ? (
                            <button
                              type="button"
                              title={`Quitar puntero ${slot}`}
                              onClick={() => removeLink(n.id, slot)}
                              className="flex size-5 items-center justify-center rounded-full border border-zinc-900 dark:border-zinc-100"
                            >
                              <X className="size-3" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              title={`Crear puntero ${slot} desde aquí`}
                              onClick={() => startLink(n.id, slot)}
                              className={cn(
                                'flex size-5 items-center justify-center rounded-full border border-dashed',
                                linking?.nodeId === n.id && linking?.slot === slot
                                  ? 'border-zinc-900 bg-zinc-900 text-zinc-50 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                                  : 'border-zinc-400 text-zinc-500 hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-600 dark:hover:border-zinc-100 dark:hover:text-zinc-100',
                              )}
                            >
                              <Plus className="size-3" />
                            </button>
                          )}
                        </span>
                        {slot < p - 1 && (
                          slot < n.keys.length ? (
                            <span className="group/key relative flex min-w-0 items-center border-l border-border">
                              <Input
                                defaultValue={n.keys[slot]}
                                key={`${n.id}-${slot}-${n.keys[slot]}`}
                                inputMode="numeric"
                                aria-label={`Clave ${slot + 1}`}
                                className={cn('h-8 min-w-0 flex-1 rounded-none border-0 bg-transparent px-0 text-center text-sm shadow-none focus-visible:ring-0', bad && 'text-red-600 dark:text-red-400')}
                                onBlur={(e) => editKey(n.id, slot, e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                              />
                              <button
                                type="button"
                                title="Quitar clave"
                                onClick={() => removeKey(n.id, slot)}
                                className="absolute -top-0.5 right-0 rounded-full bg-card p-0.5 text-muted-foreground hover:text-foreground max-sm:opacity-100 sm:opacity-0 sm:group-hover/key:opacity-100"
                              >
                                <X className="size-3" />
                              </button>
                            </span>
                          ) : (
                            <span className="flex min-w-0 items-center border-l border-border">
                              <Input
                                key={`${n.id}-empty-${slot}`}
                                data-empty-cell={n.id}
                                inputMode="numeric"
                                aria-label={`Clave vacía ${slot + 1}`}
                                className="h-8 min-w-0 flex-1 rounded-none border-0 bg-transparent px-0 text-center text-sm text-muted-foreground shadow-none focus-visible:ring-0"
                                onBlur={(e) => { addKey(n.id, e.target.value); e.target.value = ''; }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    addKey(n.id, (e.target as HTMLInputElement).value);
                                    (e.target as HTMLInputElement).value = '';
                                    (e.target as HTMLInputElement).blur();
                                  }
                                }}
                              />
                            </span>
                          )
                        )}
                      </span>
                    );
                  })}
                </div>

                {isTarget && (
                  <button
                    type="button"
                    onClick={() => completeLink(n.id)}
                    className="absolute -top-3 left-1/2 flex size-7 -translate-x-1/2 items-center justify-center rounded-full bg-zinc-900 text-zinc-50 shadow dark:bg-zinc-100 dark:text-zinc-900"
                    title="Conectar aquí"
                  >
                    <ArrowDownToLine className="size-4" />
                  </button>
                )}
              </div>
            );
          }}
          />
          {linking && (
            <div className="pointer-events-none absolute inset-x-2 top-2 z-10">
                <p className="mx-auto w-max max-w-full rounded-full bg-zinc-900/85 px-3 py-1 text-center text-xs text-zinc-100 dark:bg-zinc-100/90 dark:text-zinc-900">
                Tocá el icono <ArrowDownToLine className="inline size-3.5" /> del nodo destino · Esc o fondo para cancelar
              </p>
            </div>
          )}
        </div>
      )}

      <BottomToolbar>
        <Button size="sm" onClick={addNode}><Plus />Nodo</Button>
        <Button size="sm" variant="secondary" onClick={doValidate}><ShieldCheck />Validar</Button>
        {linking && <Button size="sm" variant="outline" onClick={() => setLinking(null)}><X />Cancelar</Button>}
        <Button size="sm" variant="ghost" onClick={doClear} title="Borrar todo"><Eraser /></Button>
      </BottomToolbar>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen} title="Resultado de la validación">
        {!result ? null : result.valid ? (
          <div className="flex items-center gap-2">
            <Badge variant="ok">válido</Badge>
            <p className="text-sm text-muted-foreground">El árbol cumple todas las reglas del orden p = {p}.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="error">{result.issues.length} errores</Badge>
              <p className="text-sm text-muted-foreground">Revisá los nodos marcados en rojo.</p>
            </div>
            <ul className="space-y-1.5">
              {result.issues.map((it, i) => (
                <li key={i} className="rounded-2xl border border-red-200 px-3 py-2 text-sm text-muted-foreground dark:border-red-900">
                  · {it.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Sheet>
    </div>
  );
}
