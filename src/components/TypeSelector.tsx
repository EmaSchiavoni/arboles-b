import { cn } from '../lib/utils';

export type KeyType = 'number' | 'string';

interface TypeSelectorProps {
  value: KeyType;
  onChange: (v: KeyType) => void;
}

// Segmentado 123 | Abc para elegir el tipo de clave. Siempre activo: si el
// árbol ya tiene claves, el padre pide confirmación (vaciar) antes de cambiar.
export function TypeSelector({ value, onChange }: TypeSelectorProps) {
  return (
    <div
      role="group"
      aria-label="Tipo de clave"
      title="Tipo de clave del árbol"
      className="flex shrink-0 items-center rounded-full border bg-card p-0.5"
    >
      {(['number', 'string'] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          title={v === 'number' ? 'Claves numéricas' : 'Claves de texto'}
          className={cn(
            'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
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
