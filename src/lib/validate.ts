// Validador de Árbol B manual. Trabaja sobre un grafo libre de nodos
// donde cada nodo guarda ids de hijos por slot (null = sin puntero).

export interface ManualNode {
  id: string;
  keys: number[];
  slots: (string | null)[]; // longitud = keys.length + 1
  x: number;
  y: number;
}

export interface ValidationIssue {
  nodeId?: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export function validateManualTree(nodes: ManualNode[], p: number, rootId: string | null): ValidationResult {
  const issues: ValidationIssue[] = [];
  const min = Math.ceil((p - 1) / 2);
  const max = p - 1;

  if (nodes.length === 0) return { valid: true, issues: [] };
  const byId = new Map(nodes.map((n) => [n.id, n]));

  if (!rootId || !byId.has(rootId)) {
    issues.push({ message: 'Elegí un nodo raíz para validar el árbol.' });
    return { valid: false, issues };
  }

  // 1. Claves ordenadas, sin duplicados, enteros, y slots coherentes.
  for (const n of nodes) {
    if (n.keys.length > max) {
      issues.push({ nodeId: n.id, message: `Tiene ${n.keys.length} claves, el máximo con p=${p} es ${max}.` });
    }
    const isRoot = n.id === rootId;
    if (!isRoot && n.keys.length < min) {
      issues.push({ nodeId: n.id, message: `Tiene ${n.keys.length} claves, el mínimo con p=${p} es ${min}.` });
    }
    if (isRoot && n.keys.length < 1) {
      issues.push({ nodeId: n.id, message: 'La raíz no puede estar vacía si hay nodos.' });
    }
    for (const k of n.keys) {
      if (!Number.isInteger(k)) {
        issues.push({ nodeId: n.id, message: 'Hay claves no enteras. Usá solo enteros.' });
        break;
      }
    }
    const sorted = [...n.keys].sort((a, b) => a - b);
    for (let i = 0; i < n.keys.length; i += 1) {
      if (n.keys[i] !== sorted[i]) {
        issues.push({ nodeId: n.id, message: 'Las claves no están ordenadas de menor a mayor.' });
        break;
      }
    }
    if (new Set(n.keys).size !== n.keys.length) {
      issues.push({ nodeId: n.id, message: 'Hay claves duplicadas dentro del nodo.' });
    }
    if (n.slots.length !== n.keys.length + 1) {
      issues.push({ nodeId: n.id, message: 'La cantidad de punteros no coincide con claves+1.' });
    }
  }

  // 2. Punteros: destinos existentes, sin ciclos, un solo padre, hijos exactos.
  const parentOf = new Map<string, string>();
  for (const n of nodes) {
    const outs = n.slots.filter((s): s is string => s !== null);
    for (const target of outs) {
      if (!byId.has(target)) {
        issues.push({ nodeId: n.id, message: 'Un puntero apunta a un nodo que no existe.' });
        continue;
      }
      if (target === n.id) {
        issues.push({ nodeId: n.id, message: 'Un nodo no puede apuntarse a sí mismo.' });
      }
      if (parentOf.has(target)) {
        issues.push({ nodeId: target, message: 'Un nodo tiene dos padres. Cada nodo (salvo la raíz) debe tener un solo padre.' });
      } else {
        parentOf.set(target, n.id);
      }
    }
  }
  for (const n of nodes) {
    if (n.id === rootId) continue;
    if (!parentOf.has(n.id)) {
      issues.push({ nodeId: n.id, message: 'El nodo está suelto: nadie apunta hacia él.' });
    }
  }

  // Hijos: 0 o keys+1 (contando solo slots conectados; los null deben ser todos o ninguno).
  for (const n of nodes) {
    const connected = n.slots.filter((s) => s !== null).length;
    if (connected !== 0 && connected !== n.slots.length) {
      issues.push({ nodeId: n.id, message: 'Si el nodo tiene hijos, todos los slots deben estar conectados.' });
    }
  }

  // 3. Alcanzabilidad desde la raíz + ciclos.
  const visited = new Set<string>();
  const stack = new Set<string>();
  let hasCycle = false;
  function dfs(id: string) {
    if (stack.has(id)) {
      hasCycle = true;
      return;
    }
    if (visited.has(id)) return;
    visited.add(id);
    stack.add(id);
    const n = byId.get(id);
    if (n) {
      for (const t of n.slots) if (t) dfs(t);
    }
    stack.delete(id);
  }
  dfs(rootId);
  if (hasCycle) issues.push({ message: 'Hay un ciclo de punteros. Un Árbol B no puede tener ciclos.' });
  for (const n of nodes) {
    if (!visited.has(n.id)) {
      issues.push({ nodeId: n.id, message: 'No es alcanzable desde la raíz.' });
    }
  }

  // 4. Orden de claves entre padre e hijos + hojas a igual profundidad.
  const leafDepths = new Set<number>();
  function checkOrder(nodeId: string, low: number, high: number, depth: number) {
    const n = byId.get(nodeId);
    if (!n) return;
    for (const k of n.keys) {
      if (!(k > low && k < high)) {
        issues.push({ nodeId: n.id, message: `La clave ${k} está fuera del rango permitido (${low}, ${high}).` });
      }
    }
    const connected = n.slots.filter((s) => s !== null);
    if (connected.length === 0) {
      leafDepths.add(depth);
      return;
    }
    const bounds: [number, number][] = [];
    let prev = low;
    for (const k of n.keys) {
      bounds.push([prev, k]);
      prev = k;
    }
    bounds.push([prev, high]);
    n.slots.forEach((target, i) => {
      if (target) checkOrder(target, bounds[i][0], bounds[i][1], depth + 1);
    });
  }
  checkOrder(rootId, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, 0);
  if (leafDepths.size > 1) {
    issues.push({ message: 'No todas las hojas están a la misma profundidad.' });
  }

  // 5. Duplicados globales.
  const seen = new Map<number, string>();
  for (const n of nodes) {
    for (const k of n.keys) {
      if (seen.has(k)) {
        issues.push({ nodeId: n.id, message: `La clave ${k} está repetida en otro nodo. No se permiten duplicados.` });
        break;
      }
      seen.set(k, n.id);
    }
  }

  return { valid: issues.length === 0, issues };
}
