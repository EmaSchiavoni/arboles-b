import * as React from 'react';
import { Dices, Eraser, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import { BottomToolbar } from '../components/BottomToolbar';
import { TreeCanvas, nodeWidth, NODE_HEIGHT } from '../components/TreeCanvas';
import { contains, countKeys, countNodes, createTree, deleteKey, height, insertKey, searchPath, type BTree } from '../lib/btree';
import { layoutTree } from '../lib/layout';
import { KEYS, load, save } from '../lib/storage';
import { cn } from '../lib/utils';

interface HistItem {
  id: number;
  text: string;
}

const MIN_P = 3;
const MAX_P = 8;

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
  const [message, setMessage] = React.useState<string | null>(null);
  const [showHistory, setShowHistory] = React.useState(false);

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
    const v = Number(keyInput.trim());
    if (keyInput.trim() === '' || !Number.isInteger(v)) {
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
    const next = insertKey({ ...tree, p }, k);
    setTree(next);
    setHighlight(new Set(searchPath(next.root, k)));
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
    setMessage(`Clave ${k} eliminada.`);
    pushHistory(`eliminar ${k} → ok`);
    setKeyInput('');
  }

  function doSearch() {
    const k = parseKey();
    if (k === null) return;
    const found = contains(tree.root, k);
    setHighlight(new Set(searchPath(tree.root, k)));
    setMessage(found ? `Clave ${k} encontrada.` : `Clave ${k} no encontrada.`);
    pushHistory(`buscar ${k} → ${found ? 'encontrada' : 'no encontrada'}`);
  }

  function doRandom() {
    const k = Math.floor(Math.random() * 100);
    if (contains(tree.root, k)) {
      doRandom();
      return;
    }
    const next = insertKey({ ...tree, p }, k);
    setTree(next);
    setHighlight(new Set(searchPath(next.root, k)));
    pushHistory(`insertar ${k} → ok (aleatorio)`);
    setMessage(`Clave ${k} insertada (aleatorio).`);
  }

  function doClear() {
    setTree({ p, root: null });
    setHighlight(new Set());
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
    pushHistory(`orden p=${clamped} → reconstruido con ${keys.length} claves`);
  }

  const layout = React.useMemo(() => layoutTree(tree.root), [tree.root]);
  const stats = { h: height(tree.root), n: countNodes(tree.root), k: countKeys(tree.root) };

  return (
    <div className="mx-auto w-full max-w-5xl px-3 pb-28 pt-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge>orden p = {p}</Badge>
        <Badge variant="secondary">máx {p - 1} claves</Badge>
        <Badge variant="secondary">mín {Math.ceil((p - 1) / 2)} claves</Badge>
        <Badge variant="secondary">altura {stats.h}</Badge>
        <Badge variant="secondary">{stats.n} nodos · {stats.k} claves</Badge>
      </div>

      <div className="mb-3 flex items-center gap-2">
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
        <Card className="mb-3">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            El árbol está vacío. Insertá la primera clave desde la barra de abajo.
          </CardContent>
        </Card>
      ) : (
        <TreeCanvas
          nodes={layout.nodes}
          edges={layout.edges}
          highlightIds={highlight}
          renderNode={(n) => (
            <div
              data-node
              className={cn(
                'rounded-md border bg-card shadow-sm',
                highlight.has(n.id) ? 'border-zinc-900 ring-1 ring-zinc-900 dark:border-zinc-100 dark:ring-zinc-100' : 'border-border',
              )}
              style={{ minHeight: NODE_HEIGHT }}
            >
              <div className="flex items-stretch justify-center gap-1 p-2">
                {n.keys.map((k) => (
                  <span
                    key={k}
                    className={cn(
                      'flex h-8 min-w-8 items-center justify-center rounded border px-2 text-sm font-medium',
                      highlight.has(n.id) ? 'border-zinc-900 dark:border-zinc-100' : 'border-input',
                    )}
                    style={{ minWidth: 32 }}
                  >
                    {k}
                  </span>
                ))}
              </div>
              <div className="flex justify-between px-2 pb-1 text-[10px] text-muted-foreground">
                {Array.from({ length: n.keys.length + 1 }).map((_, i) => (
                  <span key={i}>▾{i}</span>
                ))}
              </div>
            </div>
          )}
        />
      )}

      {message && <p className="mt-2 text-center text-sm text-muted-foreground">{message}</p>}

      {showHistory && (
        <Card className="mt-3">
          <CardContent>
            <p className="mb-2 text-sm font-medium">Historial</p>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no hay operaciones.</p>
            ) : (
              <ul className="max-h-48 space-y-1 overflow-auto text-sm text-muted-foreground">
                {history.map((h) => (
                  <li key={h.id} className="rounded border px-2 py-1">· {h.text}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <BottomToolbar>
        <Input
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') doInsert(); }}
          inputMode="numeric"
          placeholder="Clave…"
          aria-label="Clave numérica"
          className="w-24"
        />
        <Button size="sm" onClick={doInsert}><Plus />Insertar</Button>
        <Button size="sm" variant="secondary" onClick={doDelete}><Trash2 />Eliminar</Button>
        <Button size="sm" variant="outline" onClick={doSearch}><Search />Buscar</Button>
        <Button size="sm" variant="ghost" onClick={doRandom} title="Insertar clave aleatoria"><Dices />Azar</Button>
        <Button size="sm" variant="ghost" onClick={doClear} title="Vaciar árbol"><Eraser /></Button>
        <Button size="sm" variant="outline" onClick={() => setShowHistory((s) => !s)}>
          {showHistory ? 'Ocultar' : 'Historial'}
        </Button>
      </BottomToolbar>
      {/* spacer para que la toolbar flotante no tape el canvas en mobile */}
      <div className="h-2" />
      <span className="hidden">{nodeWidth(0)}</span>
    </div>
  );
}
