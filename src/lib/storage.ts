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
  manual: 'arboles-b:manual-draft',
} as const;
