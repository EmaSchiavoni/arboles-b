import { cn } from '../lib/utils';

export type KeyType = 'number' | 'string';

interface TypeSelectorProps {
  value: KeyType;
  onChange: (v: KeyType) => void;
  // Bloqueado cuando el árbol ya tiene claves: el tipo se elige por adelantado.
  locked: boolean;
}

// Segmentado 123 | Abc para elegir el tipo de clave antes de la primera clave.
export function TypeSelector({ value, onChange, locked }: TypeSelectorProps) {
  return (
    <div
      role="group"
      aria-label="Tipo de clave"
      title={locked ? 'Vacía el árbol para cambiar el tipo de clave' : 'Tipo de clave del árbol'}
      className="flex shrink-0 items-center rounded-full border bg-card p-0.5"
    >
      {(['number', 'string'] as const).map((v) => (
        <button
          key={v}
          type="button"
          disabled={locked}
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          title={v === 'number' ? 'Claves numéricas' : 'Claves de texto'}
          className={cn(
            'rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
            value === v
              ? 'bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {v === 'number' ? '123' : 'Abc'}
        </button>
      ))}
    </div>
  );
}
