// Núcleo puro del Árbol B. Sin dependencias de React.
// Reglas de la cátedra: p = cantidad máxima de punteros de árbol por nodo.
// Máximo p-1 claves. Nodos no-raíz no-hoja: mínimo ceil(p/2) punteros
// (o sea, ceil(p/2)-1 claves). Raíz: 2..p punteros, salvo nodo único
// (hoja con 1..p-1 claves). Hijos: 0 o |claves|+1. Hojas al mismo nivel.

export interface BNode {
  id: string;
  keys: number[];
  children: BNode[];
}

export interface BTree {
  root: BNode | null;
  p: number;
}

export function minPointers(p: number): number {
  return Math.ceil(p / 2);
}

export function minKeys(p: number): number {
  return Math.ceil(p / 2) - 1;
}

export function maxKeys(p: number): number {
  return p - 1;
}

// ---------- Pasos detallados para el historial ----------
// Eventos estructurales que emiten inserción y borrado (solo lo
// estructural: desbordes, divisiones, préstamos, fusiones, raíz nueva).

export type Step =
  | { t: 'insert-leaf'; key: number; after: number[] }
  | { t: 'overflow'; keys: number[]; max: number }
  | { t: 'split'; left: number[]; median: number; right: number[] }
  | { t: 'promote'; median: number; after: number[] }
  | { t: 'new-root'; median: number }
  | { t: 'remove-leaf'; key: number; after: number[] }
  | { t: 'replace-pred'; key: number; pred: number }
  | { t: 'borrow-left'; down: number; up: number }
  | { t: 'borrow-right'; down: number; up: number }
  | { t: 'merge'; left: number[]; parentKey: number; right: number[] }
  | { t: 'root-replaced'; keys: number[] };

export function formatStep(s: Step): string {
  const fmt = (ks: number[]) => `[${ks.join(', ')}]`;
  switch (s.t) {
    case 'insert-leaf':
      return `insertar ${s.key} en hoja ${fmt(s.after)}`;
    case 'overflow':
      return `desbordamiento en ${fmt(s.keys)} (máx ${s.max})`;
    case 'split':
      return `dividir en ${fmt(s.left)} y ${fmt(s.right)}, mediana ${s.median}`;
    case 'promote':
      return `subir mediana ${s.median}, padre ${fmt(s.after)}`;
    case 'new-root':
      return `nueva raíz [${s.median}]`;
    case 'remove-leaf':
      return `borrar ${s.key} de hoja, queda ${fmt(s.after)}`;
    case 'replace-pred':
      return `reemplazar ${s.key} por predecesor ${s.pred}`;
    case 'borrow-left':
      return `préstamo izq.: baja ${s.down}, sube ${s.up}`;
    case 'borrow-right':
      return `préstamo der.: baja ${s.down}, sube ${s.up}`;
    case 'merge':
      return `fusión ${fmt(s.left)} + ${s.parentKey} + ${fmt(s.right)}`;
    case 'root-replaced':
      return `nueva raíz ${fmt(s.keys)}`;
  }
}

let idCounter = 0;
export function makeNode(keys: number[] = [], children: BNode[] = []): BNode {
  idCounter += 1;
  return { id: `n${Date.now().toString(36)}${idCounter}`, keys: [...keys].sort((a, b) => a - b), children };
}

export function cloneTree(root: BNode | null): BNode | null {
  if (!root) return null;
  return { id: root.id, keys: [...root.keys], children: root.children.map(cloneTree) as BNode[] };
}

export function createTree(p: number): BTree {
  return { root: null, p };
}

export function height(root: BNode | null): number {
  let h = 0;
  let cur = root;
  while (cur) {
    h += 1;
    cur = cur.children[0] ?? null;
  }
  return h;
}

export function countNodes(root: BNode | null): number {
  if (!root) return 0;
  return 1 + root.children.reduce((acc, c) => acc + countNodes(c), 0);
}

export function countKeys(root: BNode | null): number {
  if (!root) return 0;
  return root.keys.length + root.children.reduce((acc, c) => acc + countKeys(c), 0);
}

export function searchPath(root: BNode | null, key: number): string[] {
  const path: string[] = [];
  let cur = root;
  while (cur) {
    path.push(cur.id);
    let i = 0;
    while (i < cur.keys.length && key > cur.keys[i]) i += 1;
    if (i < cur.keys.length && key === cur.keys[i]) break;
    if (cur.children.length === 0) break;
    cur = cur.children[i] ?? null;
  }
  return path;
}

export function contains(root: BNode | null, key: number): boolean {
  let cur = root;
  while (cur) {
    let i = 0;
    while (i < cur.keys.length && key > cur.keys[i]) i += 1;
    if (i < cur.keys.length && key === cur.keys[i]) return true;
    if (cur.children.length === 0) return false;
    cur = cur.children[i] ?? null;
  }
  return false;
}

// ---------- Inserción bottom-up ----------
// Se inserta recursivamente y al volver se parte el nodo solo si desbordó
// (p claves, una más que el máximo). Así el nodo a partir siempre tiene
// cantidad impar de claves y ambos lados quedan con >= minKeys, para todo p.

function splitOverflow(node: BNode, p: number, steps?: Step[]): { median: number; right: BNode } {
  const mid = Math.floor(p / 2);
  steps?.push({ t: 'overflow', keys: [...node.keys], max: maxKeys(p) });
  const median = node.keys[mid];
  const right = makeNode(
    node.keys.slice(mid + 1),
    node.children.length > 0 ? node.children.slice(mid + 1) : [],
  );
  node.keys = node.keys.slice(0, mid);
  if (node.children.length > 0) node.children = node.children.slice(0, mid + 1);
  steps?.push({ t: 'split', left: [...node.keys], median, right: [...right.keys] });
  void p;
  return { median, right };
}

// Devuelve null si no hubo desborde, o la mediana + mitad derecha si el
// nodo superó el máximo y el padre debe insertarlos. Registra en `touched`
// los ids de los nodos creados o modificados (hoja que recibe la clave,
// padres que reciben una mediana y mitades derechas de cada división).
function insertRec(
  node: BNode,
  key: number,
  p: number,
  touched: Set<string>,
  steps?: Step[],
): { median: number; right: BNode } | null {
  let i = 0;
  while (i < node.keys.length && key > node.keys[i]) i += 1;
  if (i < node.keys.length && node.keys[i] === key) return null; // Duplicado.
  if (node.children.length === 0) {
    node.keys.splice(i, 0, key);
    touched.add(node.id);
    steps?.push({ t: 'insert-leaf', key, after: [...node.keys] });
  } else {
    const res = insertRec(node.children[i], key, p, touched, steps);
    if (!res) return null;
    node.keys.splice(i, 0, res.median);
    node.children.splice(i + 1, 0, res.right);
    touched.add(node.id);
    touched.add(res.right.id);
    steps?.push({ t: 'promote', median: res.median, after: [...node.keys] });
  }
  if (node.keys.length > maxKeys(p)) {
    const out = splitOverflow(node, p, steps);
    touched.add(out.right.id);
    return out;
  }
  return null;
}

export function insertKey(tree: BTree, key: number): BTree {
  return insertKeyTracked(tree, key).tree;
}

// Igual que insertKey, pero además devuelve los ids de los nodos que la
// inserción creó o modificó (divisiones incluidas), para resaltarlos en la UI.
export function insertKeyTracked(tree: BTree, key: number): { tree: BTree; touched: string[] } {
  const r = insertKeyLogged(tree, key);
  return { tree: r.tree, touched: r.touched };
}

export function insertKeyLogged(tree: BTree, key: number): { tree: BTree; touched: string[]; steps: Step[] } {
  if (!Number.isFinite(key) || !Number.isInteger(key)) return { tree, touched: [], steps: [] };
  const root = cloneTree(tree.root);
  const p = tree.p;
  const touched = new Set<string>();
  const steps: Step[] = [];
  if (!root) {
    const r = makeNode([key]);
    touched.add(r.id);
    steps.push({ t: 'insert-leaf', key, after: [key] });
    return { tree: { p, root: r }, touched: [...touched], steps };
  }
  if (contains(root, key)) return { tree: { p, root }, touched: [], steps: [] };
  const res = insertRec(root, key, p, touched, steps);
  if (res) {
    const newRoot = makeNode([res.median], [root, res.right]);
    touched.add(newRoot.id);
    steps.push({ t: 'new-root', median: res.median });
    return { tree: { p, root: newRoot }, touched: [...touched], steps };
  }
  return { tree: { p, root }, touched: [...touched], steps };
}

// ---------- Eliminación clásica ----------

function getPredecessor(node: BNode): number {
  let cur = node;
  while (cur.children.length > 0) cur = cur.children[cur.children.length - 1];
  return cur.keys[cur.keys.length - 1];
}

function mergeChildren(parent: BNode, index: number): void {
  const left = parent.children[index];
  const right = parent.children[index + 1];
  left.keys.push(parent.keys[index], ...right.keys);
  left.children.push(...right.children);
  parent.keys.splice(index, 1);
  parent.children.splice(index + 1, 1);
}

// Repara al hijo `index` si quedó por debajo del mínimo al volver de la
// recursión (préstamo de un hermano o fusión con un hermano). La fusión le
// cuesta una clave al padre; si el padre cae bajo el mínimo, lo repara su
// propio padre al volver (cascada hasta la raíz, que no tiene mínimo).
// Normalización de la cátedra: ante subocupación se pide SIEMPRE primero al
// hermano izquierdo (préstamo y fusión) y luego al derecho.
function fixChild(parent: BNode, index: number, p: number, steps?: Step[]): void {
  const min = minKeys(p);
  for (let guard = 0; guard < 3; guard += 1) {
    const child = parent.children[index];
    if (!child || child.keys.length >= min) return;
    const leftSibling = index > 0 ? parent.children[index - 1] : null;
    const rightSibling = index < parent.children.length - 1 ? parent.children[index + 1] : null;
    if (leftSibling && leftSibling.keys.length > min) {
      // Préstamo desde la izquierda.
      const down = parent.keys[index - 1];
      child.keys.unshift(down);
      const up = leftSibling.keys.pop() as number;
      parent.keys[index - 1] = up;
      if (leftSibling.children.length > 0) {
        child.children.unshift(leftSibling.children.pop() as BNode);
      }
      steps?.push({ t: 'borrow-left', down, up });
      return;
    }
    if (rightSibling && rightSibling.keys.length > min) {
      // Préstamo desde la derecha.
      const down = parent.keys[index];
      child.keys.push(down);
      const up = rightSibling.keys.shift() as number;
      parent.keys[index] = up;
      if (rightSibling.children.length > 0) {
        child.children.push(rightSibling.children.shift() as BNode);
      }
      steps?.push({ t: 'borrow-right', down, up });
      return;
    }
    if (leftSibling) {
      steps?.push({
        t: 'merge',
        left: [...leftSibling.keys],
        parentKey: parent.keys[index - 1],
        right: [...child.keys],
      });
      mergeChildren(parent, index - 1);
      return;
    }
    if (rightSibling) {
      steps?.push({
        t: 'merge',
        left: [...child.keys],
        parentKey: parent.keys[index],
        right: [...rightSibling.keys],
      });
      mergeChildren(parent, index);
      return;
    }
    return; // Sin hermanos: no hay nada que reparar (no debería pasar).
  }
}

function removeFromNode(node: BNode, key: number, p: number, steps?: Step[]): void {
  const idx = node.keys.findIndex((k) => k === key);
  if (idx !== -1) {
    if (node.children.length === 0) {
      // Caso 1: hoja.
      node.keys.splice(idx, 1);
      steps?.push({ t: 'remove-leaf', key, after: [...node.keys] });
      return;
    }
    // Clave en nodo interno: se reemplaza por el predecesor (subárbol
    // izquierdo, misma normalización) y se borra el predecesor de ese lado. Si ese hijo queda bajo el mínimo,
    // fixChild lo repara al volver (préstamo o fusión con el derecho).
    // No se fusiona acá: con p impar, fusionar dos mínimos + la clave del
    // padre supera el máximo y la recursión no siempre lo compensa.
    const leftChild = node.children[idx];
    const pred = getPredecessor(leftChild);
    node.keys[idx] = pred;
    steps?.push({ t: 'replace-pred', key, pred });
    removeFromNode(leftChild, pred, p, steps);
    fixChild(node, idx, p, steps);
    return;
  }
  if (node.children.length === 0) return; // No existe.
  let i = 0;
  while (i < node.keys.length && key > node.keys[i]) i += 1;
  removeFromNode(node.children[i], key, p, steps);
  fixChild(node, i, p, steps);
}

export function deleteKey(tree: BTree, key: number): BTree {
  return deleteKeyLogged(tree, key).tree;
}

export function deleteKeyLogged(tree: BTree, key: number): { tree: BTree; steps: Step[] } {
  const root = cloneTree(tree.root);
  const p = tree.p;
  const steps: Step[] = [];
  if (!root) return { tree: { p, root: null }, steps };
  if (!contains(root, key)) return { tree: { p, root }, steps };
  removeFromNode(root, key, p, steps);
  if (root.keys.length === 0) {
    if (root.children.length > 0) {
      steps.push({ t: 'root-replaced', keys: [...root.children[0].keys] });
      return { tree: { p, root: root.children[0] }, steps };
    }
    return { tree: { p, root: null }, steps };
  }
  return { tree: { p, root }, steps };
}
