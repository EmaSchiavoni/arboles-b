import * as React from 'react';
import { cn } from '../lib/utils';

// Barra de acciones flotante, abajo y centrada, con ancho mínimo.
// No usar top bars ni sidebars para acciones: todo pasa por acá.
export function BottomToolbar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'fixed bottom-3 left-1/2 z-40 w-max max-w-[calc(100vw-1rem)] -translate-x-1/2',
        'mb-[env(safe-area-inset-bottom)] flex flex-wrap items-center justify-center gap-2',
        'rounded-full border bg-card/95 px-2 py-2 shadow-lg backdrop-blur',
        // En pantallas pequeñas (<=510px): todo el ancho, solo borde superior.
        'max-[510px]:bottom-0 max-[510px]:left-0 max-[510px]:right-0 max-[510px]:mb-0 max-[510px]:w-full max-[510px]:max-w-none max-[510px]:translate-x-0',
        'max-[510px]:rounded-none max-[510px]:border-x-0 max-[510px]:border-b-0 max-[510px]:px-3 max-[510px]:pb-[calc(0.5rem+env(safe-area-inset-bottom))]',
        className,
      )}
    >
      {children}
    </div>
  );
}
