import type { BNode } from './btree';

// Layout por niveles para el canvas de solo lectura.
// Devuelve posiciones en un espacio virtual que el canvas escala con pan/zoom.
export interface PlacedNode {
  id: string;
  keys: number[];
  x: number;
  y: number;
  depth: number;
}

export const NODE_W = 120;
export const NODE_H = 64;
export const LEVEL_GAP = 90;
export const SIBLING_GAP = 24;

export function layoutTree(root: BNode | null, nodeW: number = NODE_W): { nodes: PlacedNode[]; edges: { from: string; to: string; slot: number }[] } {
  if (!root) return { nodes: [], edges: [] };
  const nodes: PlacedNode[] = [];
  const edges: { from: string; to: string; slot: number }[] = [];
  let cursor = 0;

  function firstPass(n: BNode, depth: number): number {
    if (n.children.length === 0) {
      const x = cursor;
      cursor += 1;
      (n as unknown as { __x?: number }).__x = x;
      void depth;
      return x;
    }
    const xs = n.children.map((c) => firstPass(c, depth + 1));
    const x = (xs[0] + xs[xs.length - 1]) / 2;
    (n as unknown as { __x?: number }).__x = x;
    return x;
  }

  function secondPass(n: BNode, depth: number) {
    const ux = (n as unknown as { __x?: number }).__x ?? 0;
    nodes.push({
      id: n.id,
      keys: [...n.keys],
      x: ux * (nodeW + SIBLING_GAP),
      y: depth * (NODE_H + LEVEL_GAP),
      depth,
    });
    n.children.forEach((c, i) => {
      edges.push({ from: n.id, to: c.id, slot: i });
      secondPass(c, depth + 1);
    });
  }

  firstPass(root, 0);
  secondPass(root, 0);
  return { nodes, edges };
}
