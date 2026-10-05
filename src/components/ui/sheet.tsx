import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
}

// Bottom sheet estilo shadcn: lámina inferior con overlay, cierre con X,
// clic fuera o Esc. En mobile ocupa todo el ancho; en desktop se centra.
export function Sheet({ open, onOpenChange, title, children }: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="animate-fade-in fixed inset-0 z-50 bg-zinc-950/60" />
        <Dialog.Content
          className={cn(
            'animate-sheet-up fixed inset-x-0 bottom-0 z-50 max-h-[70dvh] overflow-auto',
            'rounded-t-3xl border border-b-0 bg-card shadow-lg focus:outline-none',
            'sm:bottom-6 sm:mx-auto sm:w-full sm:max-w-lg sm:rounded-3xl sm:border-b',
          )}
        >
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <Dialog.Title className="flex-1 text-sm font-semibold">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Cerrar"
                className="rounded-full p-1 text-muted-foreground hover:bg-zinc-100 hover:text-foreground dark:hover:bg-zinc-800"
              >
                <X className="size-4" />
              </button>
            </Dialog.Close>
          </div>
          <div className="px-4 py-3">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
