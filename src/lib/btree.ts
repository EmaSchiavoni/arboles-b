// Núcleo puro del Árbol B. Sin dependencias de React.
// Reglas de la cátedra: p = cantidad máxima de punteros de árbol por nodo.
// Máximo p-1 claves. Nodos no-raíz no-hoja: mínimo ceil(p/2) punteros
// (o sea, ceil(p/2)-1 claves). Raíz: 2..p punteros, salvo nodo único
// (hoja con 1..p-1 claves). Hijos: 0 o |claves|+1. Hojas al mismo nivel.

export type Key = number | string;

export interface BNode {
  id: string;
  keys: Key[];
  children: BNode[];
}

export interface BTree {
  root: BNode | null;
  p: number;
  // Modo del árbol, elegido por adelantado: las comparaciones difieren.
  keyType: 'number' | 'string';
}

// Comparador para claves homogéneas de cualquier modo.
export function cmpKey(a: Key, b: Key): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const x = String(a);
  const y = String(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

// Normaliza una clave entrante al modo del árbol (defensivo: la UI no
// debería enviar claves de otro modo).
export function toTreeKey(tree: BTree, key: Key): Key {
  return tree.keyType === 'string' ? String(key) : key;
}

// Política del algoritmo: qué lado priorizar ante ambigüedades. Por defecto
// la normalización de la cátedra (siempre la izquierda / predecesor).
export interface BTreePolicy {
  /** Al dividir con dos medianas candidatas (p par): cuál sube. */
  splitMedian: 'left' | 'right';
  /** Al pedir prestado por subocupación: a qué hermano primero. */
  borrowFrom: 'left' | 'right';
  /** Al fusionar por subocupación: con qué hermano primero. */
  mergeWith: 'left' | 'right';
  /** Al borrar clave de nodo interno: con qué reemplazarla. */
  replaceWith: 'pred' | 'succ';
}

export const CATEDRA_POLICY: BTreePolicy = {
  splitMedian: 'left',
  borrowFrom: 'left',
  mergeWith: 'left',
  replaceWith: 'pred',
};

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
  | { t: 'insert-leaf'; key: Key; after: Key[] }
  | { t: 'overflow'; keys: Key[]; max: number }
  | { t: 'split'; left: Key[]; median: Key; right: Key[] }
  | { t: 'promote'; median: Key; after: Key[] }
  | { t: 'new-root'; median: Key }
  | { t: 'remove-leaf'; key: Key; after: Key[] }
  | { t: 'replace-pred'; key: Key; pred: Key }
  | { t: 'replace-succ'; key: Key; succ: Key }
  | { t: 'borrow-left'; down: Key; up: Key }
  | { t: 'borrow-right'; down: Key; up: Key }
  | { t: 'merge'; left: Key[]; parentKey: Key; right: Key[] }
  | { t: 'root-replaced'; keys: Key[] };

export function formatStep(s: Step): string {
  const fmt = (ks: Key[]) => `[${ks.join(', ')}]`;
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
    case 'replace-succ':
      return `reemplazar ${s.key} por sucesor ${s.succ}`;
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
export function makeNode(keys: Key[] = [], children: BNode[] = []): BNode {
  idCounter += 1;
  return { id: `n${Date.now().toString(36)}${idCounter}`, keys: [...keys].sort(cmpKey), children };
}

export function cloneTree(root: BNode | null): BNode | null {
  if (!root) return null;
  return { id: root.id, keys: [...root.keys], children: root.children.map(cloneTree) as BNode[] };
}

export function createTree(p: number, keyType: BTree['keyType'] = 'number'): BTree {
  return { root: null, p, keyType };
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

export function searchPath(root: BNode | null, key: Key): string[] {
  const path: string[] = [];
  let cur = root;
  while (cur) {
    path.push(cur.id);
    let i = 0;
    while (i < cur.keys.length && cmpKey(key, cur.keys[i]) > 0) i += 1;
    if (i < cur.keys.length && key === cur.keys[i]) break;
    if (cur.children.length === 0) break;
    cur = cur.children[i] ?? null;
  }
  return path;
}

export function contains(root: BNode | null, key: Key): boolean {
  let cur = root;
  while (cur) {
    let i = 0;
    while (i < cur.keys.length && cmpKey(key, cur.keys[i]) > 0) i += 1;
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

function splitOverflow(
  node: BNode,
  p: number,
  steps?: Step[],
  policy: BTreePolicy = CATEDRA_POLICY,
): { median: Key; right: BNode } {
  // Con cantidad par de claves (p par) hay dos medianas candidatas: según la
  // política sube la de la IZQUIERDA (cátedra, la menor) o la derecha.
  const mid = policy.splitMedian === 'left' ? Math.ceil(p / 2) - 1 : Math.floor(p / 2);
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
  key: Key,
  p: number,
  touched: Set<string>,
  steps?: Step[],
  policy: BTreePolicy = CATEDRA_POLICY,
): { median: Key; right: BNode } | null {
  let i = 0;
  while (i < node.keys.length && cmpKey(key, node.keys[i]) > 0) i += 1;
  if (i < node.keys.length && node.keys[i] === key) return null; // Duplicado.
  if (node.children.length === 0) {
    node.keys.splice(i, 0, key);
    touched.add(node.id);
    steps?.push({ t: 'insert-leaf', key, after: [...node.keys] });
  } else {
    const res = insertRec(node.children[i], key, p, touched, steps, policy);
    if (!res) return null;
    node.keys.splice(i, 0, res.median);
    node.children.splice(i + 1, 0, res.right);
    touched.add(node.id);
    touched.add(res.right.id);
    steps?.push({ t: 'promote', median: res.median, after: [...node.keys] });
  }
  if (node.keys.length > maxKeys(p)) {
    const out = splitOverflow(node, p, steps, policy);
    touched.add(out.right.id);
    return out;
  }
  return null;
}

export function insertKey(tree: BTree, key: Key, policy: BTreePolicy = CATEDRA_POLICY): BTree {
  return insertKeyTracked(tree, key, policy).tree;
}

// Igual que insertKey, pero además devuelve los ids de los nodos que la
// inserción creó o modificó (divisiones incluidas), para resaltarlos en la UI.
export function insertKeyTracked(
  tree: BTree,
  key: Key,
  policy: BTreePolicy = CATEDRA_POLICY,
): { tree: BTree; touched: string[] } {
  const r = insertKeyLogged(tree, key, policy);
  return { tree: r.tree, touched: r.touched };
}

export function insertKeyLogged(
  tree: BTree,
  key: Key,
  policy: BTreePolicy = CATEDRA_POLICY,
): { tree: BTree; touched: string[]; steps: Step[] } {
  const keyType = tree.keyType === 'string' ? 'string' : 'number';
  if (keyType === 'string') {
    key = String(key);
    if (key.length === 0) return { tree, touched: [], steps: [] };
  } else if (typeof key !== 'number' || !Number.isFinite(key) || !Number.isInteger(key)) {
    return { tree, touched: [], steps: [] };
  }
  const root = cloneTree(tree.root);
  const p = tree.p;
  const touched = new Set<string>();
  const steps: Step[] = [];
  if (!root) {
    const r = makeNode([key]);
    touched.add(r.id);
    steps.push({ t: 'insert-leaf', key, after: [key] });
    return { tree: { p, root: r, keyType }, touched: [...touched], steps };
  }
  if (contains(root, key)) return { tree: { p, root, keyType }, touched: [], steps: [] };
  const res = insertRec(root, key, p, touched, steps, policy);
  if (res) {
    const newRoot = makeNode([res.median], [root, res.right]);
    touched.add(newRoot.id);
    steps.push({ t: 'new-root', median: res.median });
    return { tree: { p, root: newRoot, keyType }, touched: [...touched], steps };
  }
  return { tree: { p, root, keyType }, touched: [...touched], steps };
}

// ---------- Eliminación clásica ----------

function getPredecessor(node: BNode): Key {
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

function getSuccessor(node: BNode): Key {
  let cur = node;
  while (cur.children.length > 0) cur = cur.children[0];
  return cur.keys[0];
}

// Repara al hijo `index` si quedó por debajo del mínimo al volver de la
// recursión (préstamo de un hermano o fusión con un hermano). La fusión le
// cuesta una clave al padre; si el padre cae bajo el mínimo, lo repara su
// propio padre al volver (cascada hasta la raíz, que no tiene mínimo).
// La política decide a qué hermano pedirle primero (cátedra: izquierda).
function fixChild(
  parent: BNode,
  index: number,
  p: number,
  steps?: Step[],
  policy: BTreePolicy = CATEDRA_POLICY,
): void {
  const min = minKeys(p);
  for (let guard = 0; guard < 3; guard += 1) {
    const child = parent.children[index];
    if (!child || child.keys.length >= min) return;
    const leftSibling = index > 0 ? parent.children[index - 1] : null;
    const rightSibling = index < parent.children.length - 1 ? parent.children[index + 1] : null;
    function tryBorrowLeft(): boolean {
      if (!leftSibling || leftSibling.keys.length <= min) return false;
      // Préstamo desde la izquierda.
      const down = parent.keys[index - 1];
      child.keys.unshift(down);
      const up = leftSibling.keys.pop() as Key;
      parent.keys[index - 1] = up;
      if (leftSibling.children.length > 0) {
        child.children.unshift(leftSibling.children.pop() as BNode);
      }
      steps?.push({ t: 'borrow-left', down, up });
      return true;
    }
    function tryBorrowRight(): boolean {
      if (!rightSibling || rightSibling.keys.length <= min) return false;
      // Préstamo desde la derecha.
      const down = parent.keys[index];
      child.keys.push(down);
      const up = rightSibling.keys.shift() as Key;
      parent.keys[index] = up;
      if (rightSibling.children.length > 0) {
        child.children.push(rightSibling.children.shift() as BNode);
      }
      steps?.push({ t: 'borrow-right', down, up });
      return true;
    }
    if (policy.borrowFrom === 'left' ? tryBorrowLeft() || tryBorrowRight() : tryBorrowRight() || tryBorrowLeft()) {
      return;
    }
    const mergeOrder = policy.mergeWith === 'left' ? (['left', 'right'] as const) : (['right', 'left'] as const);
    for (const side of mergeOrder) {
      if (side === 'left' && leftSibling) {
        steps?.push({
          t: 'merge',
          left: [...leftSibling.keys],
          parentKey: parent.keys[index - 1],
          right: [...child.keys],
        });
        mergeChildren(parent, index - 1);
        return;
      }
      if (side === 'right' && rightSibling) {
        steps?.push({
          t: 'merge',
          left: [...child.keys],
          parentKey: parent.keys[index],
          right: [...rightSibling.keys],
        });
        mergeChildren(parent, index);
        return;
      }
    }
    return; // Sin hermanos: no hay nada que reparar (no debería pasar).
  }
}

function removeFromNode(node: BNode, key: Key, p: number, steps?: Step[], policy: BTreePolicy = CATEDRA_POLICY): void {
  const idx = node.keys.findIndex((k) => k === key);
  if (idx !== -1) {
    if (node.children.length === 0) {
      // Caso 1: hoja.
      node.keys.splice(idx, 1);
      steps?.push({ t: 'remove-leaf', key, after: [...node.keys] });
      return;
    }
    // Clave en nodo interno: se reemplaza por predecesor o sucesor según la
    // política y se borra del subárbol correspondiente. Si ese hijo queda
    // bajo el mínimo, fixChild lo repara al volver.
    // No se fusiona acá: con p impar, fusionar dos mínimos + la clave del
    // padre supera el máximo y la recursión no siempre lo compensa.
    if (policy.replaceWith === 'pred') {
      const leftChild = node.children[idx];
      const pred = getPredecessor(leftChild);
      node.keys[idx] = pred;
      steps?.push({ t: 'replace-pred', key, pred });
      removeFromNode(leftChild, pred, p, steps, policy);
      fixChild(node, idx, p, steps, policy);
    } else {
      const rightChild = node.children[idx + 1];
      const succ = getSuccessor(rightChild);
      node.keys[idx] = succ;
      steps?.push({ t: 'replace-succ', key, succ });
      removeFromNode(rightChild, succ, p, steps, policy);
      fixChild(node, idx + 1, p, steps, policy);
    }
    return;
  }
  if (node.children.length === 0) return; // No existe.
  let i = 0;
  while (i < node.keys.length && cmpKey(key, node.keys[i]) > 0) i += 1;
  removeFromNode(node.children[i], key, p, steps, policy);
  fixChild(node, i, p, steps, policy);
}

export function deleteKey(tree: BTree, key: Key, policy: BTreePolicy = CATEDRA_POLICY): BTree {
  return deleteKeyLogged(tree, key, policy).tree;
}

export function deleteKeyLogged(
  tree: BTree,
  key: Key,
  policy: BTreePolicy = CATEDRA_POLICY,
): { tree: BTree; steps: Step[] } {
  const keyType = tree.keyType === 'string' ? 'string' : 'number';
  const target = toTreeKey(tree, key);
  const root = cloneTree(tree.root);
  const p = tree.p;
  const steps: Step[] = [];
  if (!root) return { tree: { p, root: null, keyType }, steps };
  if (!contains(root, target)) return { tree: { p, root, keyType }, steps };
  removeFromNode(root, target, p, steps, policy);
  if (root.keys.length === 0) {
    if (root.children.length > 0) {
      steps.push({ t: 'root-replaced', keys: [...root.children[0].keys] });
      return { tree: { p, root: root.children[0], keyType }, steps };
    }
    return { tree: { p, root: null, keyType }, steps };
  }
  return { tree: { p, root, keyType }, steps };
}
