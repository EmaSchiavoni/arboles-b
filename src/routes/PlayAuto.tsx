import * as React from 'react';
import { Dices, Eraser, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import { BottomToolbar } from '../components/BottomToolbar';
import { TreeCanvas } from '../components/TreeCanvas';
import { contains, countKeys, countNodes, createTree, deleteKey, height, insertKey, insertKeyTracked, searchPath, type BTree } from '../lib/btree';
import { layoutTree } from '../lib/layout';
import { KEYS, load, save } from '../lib/storage';
import { toast } from 'sonner';
import { ConfirmDialog } from '../components/ui/alert-dialog';
import { cn } from '../lib/utils';

interface HistItem {
  id: number;
  text: string;
}

const MIN_P = 3;
const MAX_P = 8;

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
    const saved = load<{ p: number; root: BTree['root'] } | null>(KEYS.autoTree, null);
    if (saved && saved.p >= MIN_P && saved.p <= MAX_P) return { p: saved.p, root: saved.root };
    return createTree(load<number>(KEYS.autoP, 4));
  });
  const [history, setHistory] = React.useState<HistItem[]>(() => load<HistItem[]>(KEYS.autoHistory, []));
  const [keyInput, setKeyInput] = React.useState('');
  const [highlight, setHighlight] = React.useState<Set<string>>(new Set());
  const [lastKey, setLastKey] = React.useState<number | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [showHistory, setShowHistory] = React.useState(false);
  const [confirmClear, setConfirmClear] = React.useState(false);

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

  function pushHistory(text: string) {
    setHistory((h) => [{ id: Date.now() + Math.random(), text }, ...h].slice(0, 60));
  }

  function parseKey(): number | null {
    if (keyInput.trim() === '') {
      toast('Debe ingresar un valor en el campo clave antes de realizar esta operación.');
      return null;
    }
    const v = Number(keyInput.trim());
    if (!Number.isInteger(v)) {
      setMessage('Ingresá un número entero.');
      return null;
    }
    return v;
  }

  function doInsert() {
    const k = parseKey();
    if (k === null) return;
    if (contains(tree.root, k)) {
      setMessage(`La clave ${k} ya existe.`);
      pushHistory(`insertar ${k} → duplicada`);
      return;
    }
    const { tree: next, touched } = insertKeyTracked({ ...tree, p }, k);
    setTree(next);
    setHighlight(new Set(touched));
    setLastKey(k);
    setMessage(`Clave ${k} insertada.`);
    pushHistory(`insertar ${k} → ok`);
    setKeyInput('');
  }

  function doDelete() {
    const k = parseKey();
    if (k === null) return;
    if (!contains(tree.root, k)) {
      setMessage(`La clave ${k} no existe.`);
      pushHistory(`eliminar ${k} → no existe`);
      return;
    }
    setTree(deleteKey({ ...tree, p }, k));
    setHighlight(new Set());
    setLastKey(null);
    setMessage(`Clave ${k} eliminada.`);
    pushHistory(`eliminar ${k} → ok`);
    setKeyInput('');
  }

  function doSearch() {
    const k = parseKey();
    if (k === null) return;
    const found = contains(tree.root, k);
    setHighlight(new Set(searchPath(tree.root, k)));
    setLastKey(null);
    setMessage(found ? `Clave ${k} encontrada.` : `Clave ${k} no encontrada.`);
    pushHistory(`buscar ${k} → ${found ? 'encontrada' : 'no encontrada'}`);
  }

  function doRandom() {
    const k = Math.floor(Math.random() * 100);
    if (contains(tree.root, k)) {
      doRandom();
      return;
    }
    const { tree: next, touched } = insertKeyTracked({ ...tree, p }, k);
    setTree(next);
    setHighlight(new Set(touched));
    setLastKey(k);
    pushHistory(`insertar ${k} → ok (aleatorio)`);
    setMessage(`Clave ${k} insertada (aleatorio).`);
  }

  function doClear() {
    setTree({ p, root: null });
    setHighlight(new Set());
    setLastKey(null);
    setMessage('Árbol vaciado.');
    pushHistory('limpiar → árbol vacío');
  }

  function changeP(next: number) {
    const clamped = Math.min(MAX_P, Math.max(MIN_P, next));
    if (clamped === p) return;
    // Cambiar p reconstruye insertando las claves existentes en orden.
    const keys: number[] = [];
    (function walk(n = tree.root) {
      if (!n) return;
      n.keys.forEach((k) => keys.push(k));
      n.children.forEach((c) => walk(c));
    })();
    keys.sort((a, b) => a - b);
    let rebuilt: BTree = { p: clamped, root: null };
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
      <div className="flex max-w-[calc(100vw-190px)] shrink-0 flex-wrap items-center gap-2 px-3 pt-2">
        <Badge>orden p = {p}</Badge>
        <Badge variant="secondary">máx {p - 1} claves</Badge>
        <Badge variant="secondary">mín {Math.ceil(p / 2) - 1} claves · {Math.ceil(p / 2)} punteros</Badge>
        <Badge variant="secondary">altura {stats.h}</Badge>
        <Badge variant="secondary">{stats.n} nodos · {stats.k} claves</Badge>
      </div>

      <div className="flex shrink-0 items-center gap-2 px-3 py-2">
        <label htmlFor="orden-auto" className="text-sm text-muted-foreground">Orden p ({MIN_P}–{MAX_P})</label>
        <input
          id="orden-auto"
          type="range"
          min={MIN_P}
          max={MAX_P}
          value={p}
          onChange={(e) => changeP(Number(e.target.value))}
          className="h-2 w-40 accent-zinc-900 dark:accent-zinc-100"
        />
        <span className="text-sm font-medium">{p}</span>
      </div>

      {tree.root === null ? (
        <div className="min-h-0 flex-1 p-3">
          <Card className="mb-3">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              El árbol está vacío. Insertá la primera clave desde la barra de abajo.
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="relative min-h-0 flex-1">
          <TreeCanvas
          nodes={layout.nodes}
          edges={layout.edges}
          highlightIds={highlight}
          getNodeWidth={() => autoTableWidth(p)}
          getSlotX={(n, slot) => autoSlotX(n.x, slot)}
          nodeHeight={AUTO_H}
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
                  hot ? 'border-zinc-900 ring-1 ring-zinc-900 dark:border-zinc-100 dark:ring-zinc-100' : 'border-border',
                )}
              >
                <div className="grid h-12 w-full" style={{ gridTemplateColumns: cols.join(' ') }}>
                  {Array.from({ length: p }, (_, s) => (
                    <span key={s} className="contents">
                      <span className={cn('flex items-center justify-center', s > 0 && 'border-l border-border')}>
                        <span
                          title={connected.has(`${n.id}:${s}`) ? `Puntero ${s} conectado` : `Puntero ${s} nulo`}
                          className={cn(
                            'size-1.5 rounded-full',
                            connected.has(`${n.id}:${s}`) ? 'bg-zinc-700 dark:bg-zinc-300' : 'border border-zinc-300 dark:border-zinc-700',
                          )}
                        />
                      </span>
                      {s < p - 1 && (
                        <span
                          className={cn(
                            'flex items-center justify-center border-l border-border text-sm font-medium',
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
          {(message || showHistory) && (
            <div className="pointer-events-none absolute inset-x-2 top-2 z-10 space-y-2">
              {message && (
                <p className="mx-auto w-max max-w-full rounded-full bg-zinc-900/85 px-3 py-1 text-center text-xs text-zinc-100 dark:bg-zinc-100/90 dark:text-zinc-900">
                  {message}
                </p>
              )}
              {showHistory && (
                <Card className="pointer-events-auto mx-auto max-h-56 w-full max-w-md overflow-auto">
                  <CardContent>
                    <p className="mb-2 text-sm font-medium">Historial</p>
                    {history.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Todavía no hay operaciones.</p>
                    ) : (
                      <ul className="max-h-40 space-y-1 overflow-auto text-sm text-muted-foreground">
                        {history.map((h) => (
                          <li key={h.id} className="rounded-2xl border px-2 py-1">· {h.text}</li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      <BottomToolbar>
        <div className="flex items-center justify-center gap-2 max-sm:w-full">
          <Input
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') doInsert(); }}
            inputMode="numeric"
            placeholder="Clave…"
            aria-label="Clave numérica"
            className="w-24"
          />
          <Button size="sm" onClick={doInsert} title="Insertar" aria-label="Insertar"><Plus /></Button>
          <Button size="sm" variant="secondary" onClick={doDelete} title="Eliminar" aria-label="Eliminar"><Trash2 /></Button>
          <Button size="sm" variant="outline" onClick={doSearch} title="Buscar" aria-label="Buscar"><Search /></Button>
        </div>
        <div className="flex items-center justify-center gap-2 max-sm:w-full">
          <Button size="sm" variant="ghost" onClick={doRandom} title="Insertar clave aleatoria"><Dices />Azar</Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirmClear(true)} title="Vaciar árbol"><Eraser />Vaciar</Button>
          <Button size="sm" variant="outline" onClick={() => setShowHistory((s) => !s)}>
            {showHistory ? 'Ocultar' : 'Historial'}
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
    </div>
  );
}
