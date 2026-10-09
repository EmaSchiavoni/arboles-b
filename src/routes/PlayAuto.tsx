import * as React from 'react';
import { Dices, Eraser, Plus, Search, Trash2, ChevronRight, ListCollapse } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { ScrollArea } from '../components/ui/scroll-area';
import { BottomToolbar } from '../components/BottomToolbar';
import { OrderPicker, ORDER_MAX, ORDER_MIN } from '../components/OrderPicker';
import { TypeSelector } from '../components/TypeSelector';
import { TreeCanvas } from '../components/TreeCanvas';
import { cmpKey, contains, countKeys, countNodes, createTree, deleteKeyLogged, formatStep, height, insertKey, insertKeyLogged, searchPath, toTreeKey, type BTree, type Key } from '../lib/btree';
import { layoutTree } from '../lib/layout';
import { KEYS, load, loadView, save } from '../lib/storage';
import { parseKeyList } from '../lib/keys';
import { toast } from '../components/ui/use-toast';
import { ConfirmDialog } from '../components/ui/alert-dialog';
import { cn } from '../lib/utils';

interface HistItem {
  id: number;
  text: string;
  steps?: string[];
}

// Tabla completa siempre visible: p columnas de puntero (delgadas) + p-1
// celdas de clave. Las celdas vacías se muestran como cajas vacías.
const AUTO_PTR_W = 14;
const AUTO_KEY_W = 40;
const AUTO_H = 48;

function autoTableWidth(p: number): number {
  return p * AUTO_PTR_W + (p - 1) * AUTO_KEY_W;
}

function autoSlotX(x: number, slot: number): number {
  return x + slot * (AUTO_PTR_W + AUTO_KEY_W) + AUTO_PTR_W / 2;
}

export function PlayAuto() {
  const [p, setP] = React.useState<number>(() => load<number>(KEYS.autoP, 4));
  const [tree, setTree] = React.useState<BTree>(() => {
    const saved = load<{ p: number; root: BTree['root']; keyType?: BTree['keyType'] } | null>(KEYS.autoTree, null);
    if (saved && saved.p >= ORDER_MIN && saved.p <= ORDER_MAX) {
      return { p: saved.p, root: saved.root, keyType: saved.keyType === 'string' ? 'string' : 'number' };
    }
    return createTree(load<number>(KEYS.autoP, 4));
  });
  const [history, setHistory] = React.useState<HistItem[]>(() => load<HistItem[]>(KEYS.autoHistory, []));
  const [keyInput, setKeyInput] = React.useState('');
  const [highlight, setHighlight] = React.useState<Set<string>>(new Set());
  const [lastKey, setLastKey] = React.useState<Key | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [showHistory, setShowHistory] = React.useState(false);
  const [confirmClear, setConfirmClear] = React.useState(false);
  const [confirmType, setConfirmType] = React.useState<BTree['keyType'] | null>(null);
  const [openSteps, setOpenSteps] = React.useState<number | null>(null);

  // Vista del canvas (paneo/zoom): se restaura al abrir y se guarda con
  // debounce en cada cambio (más un volcado al desmontar por cambio de modo).
  const [initialView] = React.useState(() => loadView(KEYS.autoView) ?? { x: 16, y: 150, k: 1 });
  const viewRef = React.useRef({ x: 16, y: 16, k: 1 });
  const viewTimer = React.useRef<number | null>(null);
  function handleViewChange(v: { x: number; y: number; k: number; w: number; h: number }) {
    viewRef.current = v;
    if (viewTimer.current !== null) window.clearTimeout(viewTimer.current);
    viewTimer.current = window.setTimeout(() => {
      save(KEYS.autoView, { x: v.x, y: v.y, k: v.k });
    }, 400);
  }
  React.useEffect(
    () => () => {
      if (viewTimer.current !== null) {
        window.clearTimeout(viewTimer.current);
        const v = viewRef.current;
        save(KEYS.autoView, { x: v.x, y: v.y, k: v.k });
      }
    },
    [],
  );

  React.useEffect(() => {
    save(KEYS.autoP, p);
    if (tree.p !== p) setTree((t) => ({ ...t, p }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p]);

  React.useEffect(() => {
    save(KEYS.autoTree, tree);
  }, [tree]);

  React.useEffect(() => {
    save(KEYS.autoHistory, history.slice(0, 60));
  }, [history]);

  function pushHistory(text: string, steps: string[] = []) {
    setHistory((h) => [{ id: Date.now() + Math.random(), text, steps }, ...h].slice(0, 60));
  }

  function parseKeys(): Key[] | null {
    const r = parseKeyList(keyInput, tree.keyType);
    if (!r.ok) {
      if (r.reason === 'empty') {
        toast({ description: 'Debe ingresar un valor en el campo clave antes de realizar esta operación.' });
      } else if (tree.keyType === 'string') {
        setMessage('Ingresá texto separado por un único separador (,, ., - o espacio).');
      } else {
        setMessage('Ingresá un número entero o una lista con un único separador (,, ., - o espacio).');
      }
      return null;
    }
    return r.keys;
  }

  function plural(n: number, one: string, many: string) {
    return `${n} ${n === 1 ? one : many}`;
  }

  // Cambiar el tipo con el árbol vacío es directo; con claves pide
  // confirmación porque vacía el árbol.
  function changeKeyType(next: BTree['keyType']) {
    if (next === tree.keyType) return;
    if (countKeys(tree.root) === 0) {
      setTree({ p, root: null, keyType: next });
      setHighlight(new Set());
      setLastKey(null);
      return;
    }
    setConfirmType(next);
  }

  function confirmTypeChange() {
    if (!confirmType) return;
    setTree({ p, root: null, keyType: confirmType });
    setHighlight(new Set());
    setLastKey(null);
    setMessage(`Tipo cambiado a ${confirmType === 'string' ? 'texto' : 'numérico'}. Árbol vaciado.`);
    pushHistory(`tipo → ${confirmType === 'string' ? 'texto' : 'numérico'} (árbol vaciado)`);
    setConfirmType(null);
  }

  function doInsert() {
    const ks = parseKeys();
    if (!ks) return;
    let cur = { ...tree, p };
    let inserted = 0;
    let dups = 0;
    let touched: string[] = [];
    let lastK: Key | null = null;
    for (const k of ks) {
      const kk = toTreeKey(cur, k);
      if (contains(cur.root, kk)) {
        dups += 1;
        pushHistory(`insertar ${kk} → duplicada`);
        continue;
      }
      const r = insertKeyLogged(cur, kk);
      cur = r.tree;
      touched = r.touched;
      lastK = kk;
      inserted += 1;
      pushHistory(`insertar ${kk} → ok`, r.steps.map(formatStep));
    }
    setTree(cur);
    setHighlight(new Set(touched));
    setLastKey(lastK);
    if (ks.length === 1) {
      setMessage(inserted === 1 ? `Clave ${ks[0]} insertada.` : `La clave ${ks[0]} ya existe.`);
    } else {
      const parts = [plural(inserted, 'insertada', 'insertadas')];
      if (dups > 0) parts.push(plural(dups, 'duplicada', 'duplicadas'));
      setMessage(parts.join(', ') + '.');
    }
    setKeyInput('');
  }

  function doDelete() {
    const ks = parseKeys();
    if (!ks) return;
    let cur = { ...tree, p };
    let deleted = 0;
    let missing = 0;
    for (const k of ks) {
      const kk = toTreeKey(cur, k);
      if (!contains(cur.root, kk)) {
        missing += 1;
        pushHistory(`eliminar ${kk} → no existe`);
        continue;
      }
      const r = deleteKeyLogged(cur, kk);
      cur = r.tree;
      deleted += 1;
      pushHistory(`eliminar ${kk} → ok`, r.steps.map(formatStep));
    }
    setTree(cur);
    setHighlight(new Set());
    setLastKey(null);
    if (ks.length === 1) {
      setMessage(deleted === 1 ? `Clave ${ks[0]} eliminada.` : `La clave ${ks[0]} no existe.`);
    } else {
      const parts = [plural(deleted, 'eliminada', 'eliminadas')];
      if (missing > 0) parts.push(plural(missing, 'no existía', 'no existían'));
      setMessage(parts.join(', ') + '.');
    }
    setKeyInput('');
  }

  function doSearch() {
    const ks = parseKeys();
    if (!ks) return;
    setLastKey(null);
    const path = new Set<string>();
    const found: Key[] = [];
    const lost: Key[] = [];
    for (const k of ks) {
      const kk = toTreeKey(tree, k);
      searchPath(tree.root, kk).forEach((id) => path.add(id));
      if (contains(tree.root, kk)) {
        found.push(kk);
        pushHistory(`buscar ${kk} → encontrada`);
      } else {
        lost.push(kk);
        pushHistory(`buscar ${kk} → no encontrada`);
      }
    }
    setHighlight(path);
    if (ks.length === 1) {
      setMessage(found.length === 1 ? `Clave ${ks[0]} encontrada.` : `Clave ${ks[0]} no encontrada.`);
    } else {
      const parts: string[] = [];
      if (found.length > 0) parts.push(`encontradas: ${found.join(', ')}`);
      if (lost.length > 0) parts.push(`no encontradas: ${lost.join(', ')}`);
      setMessage(parts.join('. ') + '.');
    }
  }

  function doRandom() {
    const k = Math.floor(Math.random() * 100);
    const kk = toTreeKey(tree, k);
    if (contains(tree.root, kk)) {
      doRandom();
      return;
    }
    const { tree: next, touched, steps } = insertKeyLogged({ ...tree, p }, kk);
    setTree(next);
    setHighlight(new Set(touched));
    setLastKey(kk);
    pushHistory(`insertar ${kk} → ok (aleatorio)`, steps.map(formatStep));
    setMessage(`Clave ${kk} insertada (aleatorio).`);
  }

  function doClear() {
    // Vaciar conserva el tipo elegido (es un ajuste como el orden).
    setTree({ p, root: null, keyType: tree.keyType });
    setHighlight(new Set());
    setLastKey(null);
    setMessage('Árbol vaciado.');
    pushHistory('limpiar → árbol vacío');
  }

  function changeP(next: number) {
    const clamped = Math.min(ORDER_MAX, Math.max(ORDER_MIN, next));
    if (clamped === p) return;
    // Cambiar p reconstruye insertando las claves existentes en orden.
    const keys: Key[] = [];
    (function walk(n = tree.root) {
      if (!n) return;
      n.keys.forEach((k) => keys.push(k));
      n.children.forEach((c) => walk(c));
    })();
    keys.sort(cmpKey);
    let rebuilt: BTree = { p: clamped, root: null, keyType: tree.keyType };
    for (const k of keys) rebuilt = insertKey(rebuilt, k);
    setP(clamped);
    setTree(rebuilt);
    setHighlight(new Set());
    setLastKey(null);
    pushHistory(`orden p=${clamped} → reconstruido con ${keys.length} claves`);
  }

  const layout = React.useMemo(() => layoutTree(tree.root, autoTableWidth(p)), [tree.root, p]);
  const connected = React.useMemo(() => new Set(layout.edges.map((e) => `${e.from}:${e.slot}`)), [layout]);
  const stats = { h: height(tree.root), n: countNodes(tree.root), k: countKeys(tree.root) };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative min-h-0 flex-1">
      {tree.root === null ? (
        <div className="h-full p-3">
          <Card className="mb-3">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              El árbol está vacío. Insertá la primera clave desde la barra de abajo.
            </CardContent>
          </Card>
        </div>
      ) : (
          <TreeCanvas
          nodes={layout.nodes}
          edges={layout.edges}
          highlightIds={highlight}
          getNodeWidth={() => autoTableWidth(p)}
          getSlotX={(n, slot) => autoSlotX(n.x, slot)}
          nodeHeight={AUTO_H}
          initialView={initialView}
          onViewChange={handleViewChange}
          renderNode={(n) => {
            const hot = highlight.has(n.id);
            const cols: string[] = [];
            for (let s = 0; s < p; s += 1) {
              cols.push(`${AUTO_PTR_W}px`);
              if (s < p - 1) cols.push(`${AUTO_KEY_W}px`);
            }
            return (
              <div
                data-node
                className={cn(
                  'rounded-md border bg-card shadow-sm',
                  hot ? 'border-zinc-900 ring-1 ring-zinc-900 dark:border-zinc-100 dark:ring-zinc-100' : 'border-border dark:border-zinc-700',
                )}
              >
                <div className="grid h-12 w-full" style={{ gridTemplateColumns: cols.join(' ') }}>
                  {Array.from({ length: p }, (_, s) => (
                    <span key={s} className="contents">
                      <span className={cn('flex items-center justify-center', s > 0 && 'border-l border-border dark:border-zinc-700')}>
                        <span
                          title={connected.has(`${n.id}:${s}`) ? `Puntero ${s} conectado` : `Puntero ${s} nulo`}
                          className={cn(
                            'size-1.5 rounded-full',
                            connected.has(`${n.id}:${s}`) ? 'bg-zinc-700 dark:bg-zinc-300' : 'border border-zinc-300 dark:border-zinc-600',
                          )}
                        />
                      </span>
                      {s < p - 1 && (
                        <span
                          className={cn(
                            'flex items-center justify-center border-l border-border text-sm font-medium dark:border-zinc-700',
                            lastKey !== null && n.keys[s] === lastKey && 'bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100',
                          )}
                        >
                          {n.keys[s] ?? ''}
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            );
          }}
          />
      )}
      <div className="pointer-events-none absolute left-2 top-2 z-10 flex max-w-[calc(100vw-190px)] flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>orden p = {p}</Badge>
              <Badge variant="secondary">máx {p - 1} claves</Badge>
              <Badge variant="secondary">mín {Math.ceil(p / 2) - 1} claves · {Math.ceil(p / 2)} punteros</Badge>
              <Badge variant="secondary">altura {stats.h}</Badge>
              <Badge variant="secondary">{stats.n} nodos · {stats.k} claves</Badge>
            </div>
            <div className="pointer-events-auto flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-2xl border bg-card/80 px-3 py-1.5 shadow-lg backdrop-blur">
                <OrderPicker id="orden-auto" p={p} onChange={changeP} />
              </div>
              <div className="flex items-center gap-2 rounded-2xl border bg-card/80 px-3 py-1.5 shadow-lg backdrop-blur">
                <span className="shrink-0 text-sm text-muted-foreground">Tipo de clave</span>
                <TypeSelector value={tree.keyType} onChange={changeKeyType} />
              </div>
            </div>
            {message && (
              <p className="w-max max-w-full rounded-full bg-zinc-900/85 px-3 py-1 text-xs text-zinc-100 dark:bg-zinc-100/90 dark:text-zinc-900">
                {message}
              </p>
            )}
          </div>
          <Dialog open={showHistory} onOpenChange={setShowHistory}>
            <DialogContent className="max-h-[70dvh] w-[calc(100vw-2rem)] sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Historial</DialogTitle>
              </DialogHeader>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">Todavía no hay operaciones.</p>
              ) : (
                <ScrollArea className="max-h-[50dvh] pr-3">
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {history.map((h) => (
                      <li key={h.id} className="rounded-2xl border px-2 py-1">
                        <div className="flex items-center gap-1">
                          <span className="min-w-0 flex-1">· {h.text}</span>
                          {h.steps && h.steps.length > 0 && (
                            <button
                              type="button"
                              title={openSteps === h.id ? 'Ocultar pasos' : 'Ver pasos'}
                              onClick={() => setOpenSteps((o) => (o === h.id ? null : h.id))}
                              className="flex shrink-0 items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[11px] hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            >
                              <ListCollapse className="size-3" />
                              pasos
                            </button>
                          )}
                        </div>
                        {openSteps === h.id && h.steps && h.steps.length > 0 && (
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            {h.steps.map((s, i) => (
                              <span key={i} className="contents">
                                {i > 0 && <ChevronRight className="size-3 shrink-0 text-zinc-400 dark:text-zinc-500" />}
                                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] dark:bg-zinc-800">
                                  {s}
                                </span>
                              </span>
                            ))}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              )}
            </DialogContent>
          </Dialog>
        </div>

      <BottomToolbar>
        <div className="flex items-center justify-center gap-2 max-[510px]:w-full">
          <Input
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') doInsert(); }}
            inputMode={tree.keyType === 'string' ? 'text' : 'numeric'}
            placeholder="Claves: 1, 2, 3"
            aria-label="Claves (una sola o lista separada por coma, punto, guion o espacio)"
            className="w-36"
          />
          <Button size="sm" onClick={doInsert} title="Insertar" aria-label="Insertar" className="px-2"><Plus /></Button>
          <Button size="sm" variant="secondary" onClick={doDelete} title="Eliminar" aria-label="Eliminar" className="px-2"><Trash2 /></Button>
          <Button size="sm" variant="outline" onClick={doSearch} title="Buscar" aria-label="Buscar" className="px-2"><Search /></Button>
        </div>
        <div className="flex items-center justify-center gap-2 max-[510px]:w-full">
          <Button size="sm" variant="ghost" onClick={doRandom} title="Insertar clave aleatoria"><Dices />Azar</Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirmClear(true)} title="Vaciar árbol"><Eraser />Vaciar</Button>
          <Button size="sm" variant="outline" onClick={() => setShowHistory(true)}>
            Historial
          </Button>
        </div>
      </BottomToolbar>

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Vaciar árbol"
        description="Se eliminarán todas las claves del árbol. Esta acción no se puede deshacer."
        confirmLabel="Vaciar"
        onConfirm={() => {
          doClear();
          setConfirmClear(false);
        }}
      />
      <ConfirmDialog
        open={confirmType !== null}
        onOpenChange={(o) => {
          if (!o) setConfirmType(null);
        }}
        title="Cambiar tipo de clave"
        description={`Cambiar a claves de ${confirmType === 'string' ? 'texto' : 'tipo numérico'} vaciará el árbol actual. Esta acción no se puede deshacer.`}
        confirmLabel="Vaciar y cambiar"
        onConfirm={confirmTypeChange}
      />
    </div>
  );
}
