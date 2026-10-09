export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Sin almacenamiento disponible: la app sigue funcionando en memoria.
  }
}

export const KEYS = {
  theme: 'arboles-b:tema',
  autoP: 'arboles-b:auto-p',
  autoTree: 'arboles-b:auto-tree',
  autoHistory: 'arboles-b:auto-history',
  autoPolicy: 'arboles-b:auto-policy',
  autoView: 'arboles-b:auto-view',
  manual: 'arboles-b:manual-draft',
  manualView: 'arboles-b:manual-view',
} as const;

export interface StoredView {
  x: number;
  y: number;
  k: number;
}

// Vista saneada o null si no hay nada guardado válido.
export function loadView(key: string): StoredView | null {
  const v = load<StoredView | null>(key, null);
  if (!v || !Number.isFinite(v.x) || !Number.isFinite(v.y) || !Number.isFinite(v.k)) return null;
  return { x: v.x, y: v.y, k: Math.min(3, Math.max(0.25, v.k)) };
}
