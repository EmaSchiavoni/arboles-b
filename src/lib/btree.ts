// Núcleo puro del Árbol B. Sin dependencias de React.
// Definición del proyecto: p = cantidad máxima de punteros por nodo.
// Máximo p-1 claves, mínimo ceil((p-1)/2) en nodos no-raíz.
// Raíz no vacía: 1..p-1 claves. Hijos: 0 o |claves|+1. Hojas a igual profundidad.

export interface BNode {
  id: string;
  keys: number[];
  children: BNode[];
}

export interface BTree {
  root: BNode | null;
  p: number;
}

export function minKeys(p: number): number {
  return Math.ceil((p - 1) / 2);
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

function splitChild(parent: BNode, index: number, p: number): void {
  const full = parent.children[index];
  const mid = Math.floor(full.keys.length / 2);
  const median = full.keys[mid];
  const leftKeys = full.keys.slice(0, mid);
  const rightKeys = full.keys.slice(mid + 1);
  const leftChildren = full.children.length > 0 ? full.children.slice(0, mid + 1) : [];
  const rightChildren = full.children.length > 0 ? full.children.slice(mid + 1) : [];
  const left = makeNode(leftKeys, leftChildren);
  const right = makeNode(rightKeys, rightChildren);
  full.keys = leftKeys;
  full.children = leftChildren;
  // Reutilizamos `full` como izquierda para conservar el id en el camino visual,
  // y creamos el derecho nuevo. Para no confundir, mejor crear ambos nuevos:
  parent.children[index] = { ...left, id: full.id };
  parent.children.splice(index + 1, 0, right);
  parent.keys.splice(index, 0, median);
  void p;
}

function insertNonFull(node: BNode, key: number, p: number): void {
  let i = node.keys.length - 1;
  if (node.children.length === 0) {
    // Hoja: inserción ordenada, ignora duplicados.
    if (node.keys.includes(key)) return;
    node.keys.push(key);
    node.keys.sort((a, b) => a - b);
    return;
  }
  while (i >= 0 && key < node.keys[i]) i -= 1;
  if (node.keys[i + 1] === key || node.keys[i] === key) return;
  i += 1;
  if (node.children[i].keys.length === maxKeys(p)) {
    splitChild(node, i, p);
    if (key > node.keys[i]) i += 1;
    else if (key === node.keys[i]) return;
  }
  insertNonFull(node.children[i], key, p);
}

export function insertKey(tree: BTree, key: number): BTree {
  if (!Number.isFinite(key) || !Number.isInteger(key)) return tree;
  const root = cloneTree(tree.root);
  const p = tree.p;
  if (!root) {
    return { p, root: makeNode([key]) };
  }
  if (contains(root, key)) return { p, root };
  if (root.keys.length === maxKeys(p)) {
    const newRoot = makeNode([], [root]);
    splitChild(newRoot, 0, p);
    insertNonFull(newRoot, key, p);
    return { p, root: newRoot };
  }
  insertNonFull(root, key, p);
  return { p, root };
}

// ---------- Eliminación clásica ----------

function getPredecessor(node: BNode): number {
  let cur = node;
  while (cur.children.length > 0) cur = cur.children[cur.children.length - 1];
  return cur.keys[cur.keys.length - 1];
}

function getSuccessor(node: BNode): number {
  let cur = node;
  while (cur.children.length > 0) cur = cur.children[0];
  return cur.keys[0];
}

function mergeChildren(parent: BNode, index: number): void {
  const left = parent.children[index];
  const right = parent.children[index + 1];
  left.keys.push(parent.keys[index], ...right.keys);
  left.children.push(...right.children);
  parent.keys.splice(index, 1);
  parent.children.splice(index + 1, 1);
}

function fillChild(parent: BNode, index: number, p: number): void {
  const min = minKeys(p);
  const leftSibling = index > 0 ? parent.children[index - 1] : null;
  const rightSibling = index < parent.children.length - 1 ? parent.children[index + 1] : null;
  if (leftSibling && leftSibling.keys.length > min) {
    // Préstamo desde la izquierda.
    const child = parent.children[index];
    child.keys.unshift(parent.keys[index - 1]);
    parent.keys[index - 1] = leftSibling.keys.pop() as number;
    if (leftSibling.children.length > 0) {
      child.children.unshift(leftSibling.children.pop() as BNode);
    }
  } else if (rightSibling && rightSibling.keys.length > min) {
    // Préstamo desde la derecha.
    const child = parent.children[index];
    child.keys.push(parent.keys[index]);
    parent.keys[index] = rightSibling.keys.shift() as number;
    if (rightSibling.children.length > 0) {
      child.children.push(rightSibling.children.shift() as BNode);
    }
  } else if (leftSibling) {
    mergeChildren(parent, index - 1);
  } else if (rightSibling) {
    mergeChildren(parent, index);
  }
}

function removeFromNode(node: BNode, key: number, p: number, isRoot: boolean): void {
  const min = minKeys(p);
  const idx = node.keys.findIndex((k) => k === key);
  if (idx !== -1) {
    if (node.children.length === 0) {
      // Caso 1: hoja.
      node.keys.splice(idx, 1);
      return;
    }
    const leftChild = node.children[idx];
    const rightChild = node.children[idx + 1];
    if (leftChild.keys.length > min) {
      const pred = getPredecessor(leftChild);
      node.keys[idx] = pred;
      removeFromNode(leftChild, pred, p, false);
    } else if (rightChild.keys.length > min) {
      const succ = getSuccessor(rightChild);
      node.keys[idx] = succ;
      removeFromNode(rightChild, succ, p, false);
    } else {
      mergeChildren(node, idx);
      removeFromNode(leftChild, key, p, false);
    }
    return;
  }
  if (node.children.length === 0) return; // No existe.
  let i = 0;
  while (i < node.keys.length && key > node.keys[i]) i += 1;
  const child = node.children[i];
  if (!child) return;
  if (child.keys.length <= min && !(isRoot && node.keys.length === 1 && node.children.length === 2)) {
    // Si el hijo tiene el mínimo, hay que reforzarlo antes de bajar.
    // En raíz con pocas claves igual intentamos rellenar si hay hermanos con de sobra.
    if (child.keys.length === min || child.keys.length < min) {
      // Solo rellenar si el padre tiene claves para prestar/mezclar.
      if (node.keys.length > 0) fillChild(node, i, p);
    }
  }
  // Tras un merge el índice puede haber cambiado.
  const next = node.children[Math.min(i, node.children.length - 1)];
  removeFromNode(next, key, p, false);
}

export function deleteKey(tree: BTree, key: number): BTree {
  const root = cloneTree(tree.root);
  const p = tree.p;
  if (!root) return { p, root: null };
  if (!contains(root, key)) return { p, root };
  removeFromNode(root, key, p, true);
  if (root.keys.length === 0) {
    if (root.children.length > 0) return { p, root: root.children[0] };
    return { p, root: null };
  }
  return { p, root };
}
