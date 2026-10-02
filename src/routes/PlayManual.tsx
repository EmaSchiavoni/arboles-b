import * as React from 'react';
import { ArrowDownToLine, Crown, GripVertical, Plus, Trash2, X, ShieldCheck, Eraser } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import { BottomToolbar } from '../components/BottomToolbar';
import { TreeCanvas, NODE_HEIGHT, nodeWidth } from '../components/TreeCanvas';
import { validateManualTree, type ManualNode, type ValidationResult } from '../lib/validate';
import { KEYS, load, save } from '../lib/storage';
import { cn } from '../lib/utils';

const MIN_P = 3;
const MAX_P = 8;

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
  const [newKey, setNewKey] = React.useState<Record<string, string>>({});
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

  function addKey(id: string) {
    const raw = (newKey[id] ?? '').trim();
    const v = Number(raw);
    if (raw === '' || !Number.isInteger(v)) return;
    update((d) => {
      const n = d.nodes.find((x) => x.id === id);
      if (!n || n.keys.includes(v)) return d;
      n.keys = [...n.keys, v];
      n.slots = fixSlots(n.keys, n.slots);
      return d;
    });
    setNewKey((s) => ({ ...s, [id]: '' }));
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
  }

  function doClear() {
    setDraft((d) => ({ ...d, nodes: [], rootId: null }));
    setResult(null);
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
    <div className="mx-auto w-full max-w-5xl px-3 pb-28 pt-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge>orden p = {p}</Badge>
        <Badge variant="secondary">máx {p - 1} claves</Badge>
        <Badge variant="secondary">mín {Math.ceil(p / 2) - 1} claves · {Math.ceil(p / 2)} punteros</Badge>
        {rootId ? <Badge variant="outline">raíz elegida</Badge> : <Badge variant="error">sin raíz</Badge>}
        {result && (result.valid ? <Badge variant="ok">válido</Badge> : <Badge variant="error">{result.issues.length} errores</Badge>)}
      </div>

      <div className="mb-3 flex items-center gap-2">
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

      {linking && (
        <p className="mb-2 rounded-md border border-dashed px-3 py-2 text-center text-sm">
          Tocá el icono <ArrowDownToLine className="inline size-4" /> del nodo destino para conectar el puntero · Esc o tocar el fondo para cancelar
        </p>
      )}

      {nodes.length === 0 ? (
        <Card className="mb-3">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No hay nodos. Creá el primero con el botón de la barra inferior.
          </CardContent>
        </Card>
      ) : (
        <TreeCanvas
          nodes={nodes}
          edges={edges}
          linking={!!linking}
          errorIds={errorIds}
          onBackgroundClick={() => setLinking(null)}
          renderNode={(n) => {
            const isRoot = n.id === rootId;
            const isTarget = !!linking && linking.nodeId !== n.id;
            const bad = errorIds.has(n.id);
            return (
              <div
                data-node
                className={cn(
                  'rounded-md border bg-card shadow-sm',
                  bad ? 'border-red-500 ring-1 ring-red-500' : isRoot ? 'border-zinc-900 dark:border-zinc-100' : 'border-border',
                  isTarget && 'ring-2 ring-dashed ring-zinc-500',
                )}
                style={{ minHeight: NODE_HEIGHT }}
              >
                <div
                  className="flex cursor-grab touch-none items-center gap-1 border-b px-2 py-1 text-[11px] text-muted-foreground active:cursor-grabbing"
                  onPointerDown={(e) => onNodePointerDown(e, n.id)}
                  onPointerMove={onNodePointerMove}
                  onPointerUp={onNodePointerUp}
                >
                  <GripVertical className="size-3.5" />
                  <span className="flex-1 truncate">{isRoot ? 'raíz' : 'nodo'}</span>
                  {!isRoot && (
                    <button type="button" title="Marcar como raíz" onClick={() => setRoot(n.id)} className="rounded p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                      <Crown className="size-3.5" />
                    </button>
                  )}
                  <button type="button" title="Eliminar nodo" onClick={() => deleteNode(n.id)} className="rounded p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-1 p-2">
                  {n.keys.map((k, i) => (
                    <span key={`${i}-${k}`} className="group/key flex items-center gap-0.5">
                      <Input
                        defaultValue={k}
                        key={`${n.id}-${i}`}
                        inputMode="numeric"
                        aria-label={`Clave ${i + 1}`}
                        className={cn('h-8 w-14 px-1 text-center text-sm', bad && 'border-red-400')}
                        onBlur={(e) => editKey(n.id, i, e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                      />
                      <button type="button" title="Quitar clave" onClick={() => removeKey(n.id, i)} className="rounded p-0.5 text-muted-foreground hover:text-foreground">
                        <X className="size-3.5" />
                      </button>
                    </span>
                  ))}
                  {n.keys.length < p - 1 && (
                    <span className="flex items-center gap-1">
                      <Input
                        value={newKey[n.id] ?? ''}
                        onChange={(e) => setNewKey((s) => ({ ...s, [n.id]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') addKey(n.id); }}
                        inputMode="numeric"
                        placeholder="+"
                        aria-label="Nueva clave"
                        className="h-8 w-14 px-1 text-center text-sm"
                      />
                      <button type="button" title="Agregar clave" onClick={() => addKey(n.id)} className="rounded border p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                        <Plus className="size-3.5" />
                      </button>
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between px-2 pb-2">
                  {n.slots.map((s, slot) => (
                    <span key={slot} className="group/slot relative flex flex-col items-center gap-0.5">
                      <span className="text-[10px] text-muted-foreground">p{slot}</span>
                      {s ? (
                        <button
                          type="button"
                          title="Eliminar puntero"
                          onClick={() => removeLink(n.id, slot)}
                          className="flex size-6 items-center justify-center rounded-full border border-zinc-900 text-xs dark:border-zinc-100"
                        >
                          <X className="size-3" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          title="Crear puntero desde aquí"
                          onClick={() => startLink(n.id, slot)}
                          className={cn(
                            'flex size-6 items-center justify-center rounded-full border border-dashed',
                            linking?.nodeId === n.id && linking?.slot === slot
                              ? 'border-zinc-900 bg-zinc-900 text-zinc-50 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                              : 'border-zinc-400 text-zinc-500 hover:border-zinc-900 hover:text-zinc-900 sm:opacity-60 sm:group-hover/slot:opacity-100 dark:border-zinc-600 dark:hover:border-zinc-100 dark:hover:text-zinc-100',
                          )}
                        >
                          <Plus className="size-3" />
                        </button>
                      )}
                    </span>
                  ))}
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
      )}

      {result && (
        <Card className="mt-3">
          <CardContent>
            <p className="mb-2 text-sm font-medium">{result.valid ? 'El árbol es válido.' : `Hay ${result.issues.length} problemas:`}</p>
            {!result.valid && (
              <ul className="max-h-48 space-y-1 overflow-auto text-sm text-muted-foreground">
                {result.issues.map((it, i) => (
                  <li key={i} className="rounded border border-red-200 px-2 py-1 dark:border-red-900">· {it.message}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <BottomToolbar>
        <Button size="sm" onClick={addNode}><Plus />Nodo</Button>
        <Button size="sm" variant="secondary" onClick={doValidate}><ShieldCheck />Validar</Button>
        {linking && <Button size="sm" variant="outline" onClick={() => setLinking(null)}><X />Cancelar</Button>}
        <Button size="sm" variant="ghost" onClick={doClear} title="Borrar todo"><Eraser /></Button>
      </BottomToolbar>
      <span className="hidden">{nodeWidth(0)}</span>
    </div>
  );
}
