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

function splitOverflow(node: BNode, p: number): { median: number; right: BNode } {
  const mid = Math.floor(p / 2);
  const median = node.keys[mid];
  const right = makeNode(
    node.keys.slice(mid + 1),
    node.children.length > 0 ? node.children.slice(mid + 1) : [],
  );
  node.keys = node.keys.slice(0, mid);
  if (node.children.length > 0) node.children = node.children.slice(0, mid + 1);
  void p;
  return { median, right };
}

// Devuelve null si no hubo desborde, o la mediana + mitad derecha si el
// nodo superó el máximo y el padre debe insertarlos.
function insertRec(node: BNode, key: number, p: number): { median: number; right: BNode } | null {
  let i = 0;
  while (i < node.keys.length && key > node.keys[i]) i += 1;
  if (i < node.keys.length && node.keys[i] === key) return null; // Duplicado.
  if (node.children.length === 0) {
    node.keys.splice(i, 0, key);
  } else {
    const res = insertRec(node.children[i], key, p);
    if (!res) return null;
    node.keys.splice(i, 0, res.median);
    node.children.splice(i + 1, 0, res.right);
  }
  if (node.keys.length > maxKeys(p)) return splitOverflow(node, p);
  return null;
}

export function insertKey(tree: BTree, key: number): BTree {
  if (!Number.isFinite(key) || !Number.isInteger(key)) return tree;
  const root = cloneTree(tree.root);
  const p = tree.p;
  if (!root) {
    return { p, root: makeNode([key]) };
  }
  if (contains(root, key)) return { p, root };
  const res = insertRec(root, key, p);
  if (res) {
    return { p, root: makeNode([res.median], [root, res.right]) };
  }
  return { p, root };
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
function fixChild(parent: BNode, index: number, p: number): void {
  const min = minKeys(p);
  for (let guard = 0; guard < 3; guard += 1) {
    const child = parent.children[index];
    if (!child || child.keys.length >= min) return;
    const leftSibling = index > 0 ? parent.children[index - 1] : null;
    const rightSibling = index < parent.children.length - 1 ? parent.children[index + 1] : null;
    if (leftSibling && leftSibling.keys.length > min) {
      // Préstamo desde la izquierda.
      child.keys.unshift(parent.keys[index - 1]);
      parent.keys[index - 1] = leftSibling.keys.pop() as number;
      if (leftSibling.children.length > 0) {
        child.children.unshift(leftSibling.children.pop() as BNode);
      }
      return;
    }
    if (rightSibling && rightSibling.keys.length > min) {
      // Préstamo desde la derecha.
      child.keys.push(parent.keys[index]);
      parent.keys[index] = rightSibling.keys.shift() as number;
      if (rightSibling.children.length > 0) {
        child.children.push(rightSibling.children.shift() as BNode);
      }
      return;
    }
    if (leftSibling) {
      mergeChildren(parent, index - 1);
      return;
    }
    if (rightSibling) {
      mergeChildren(parent, index);
      return;
    }
    return; // Sin hermanos: no hay nada que reparar (no debería pasar).
  }
}

function removeFromNode(node: BNode, key: number, p: number): void {
  const idx = node.keys.findIndex((k) => k === key);
  if (idx !== -1) {
    if (node.children.length === 0) {
      // Caso 1: hoja.
      node.keys.splice(idx, 1);
      return;
    }
    // Clave en nodo interno: se reemplaza por el predecesor y se borra el
    // predecesor del subárbol izquierdo. Si ese hijo queda bajo el mínimo,
    // fixChild lo repara al volver (préstamo o fusión con el derecho).
    // No se fusiona acá: con p impar, fusionar dos mínimos + la clave del
    // padre supera el máximo y la recursión no siempre lo compensa.
    const leftChild = node.children[idx];
    const pred = getPredecessor(leftChild);
    node.keys[idx] = pred;
    removeFromNode(leftChild, pred, p);
    fixChild(node, idx, p);
    return;
  }
  if (node.children.length === 0) return; // No existe.
  let i = 0;
  while (i < node.keys.length && key > node.keys[i]) i += 1;
  removeFromNode(node.children[i], key, p);
  fixChild(node, i, p);
}

export function deleteKey(tree: BTree, key: number): BTree {
  const root = cloneTree(tree.root);
  const p = tree.p;
  if (!root) return { p, root: null };
  if (!contains(root, key)) return { p, root };
  removeFromNode(root, key, p);
  if (root.keys.length === 0) {
    if (root.children.length > 0) return { p, root: root.children[0] };
    return { p, root: null };
  }
  return { p, root };
}
