import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import { cn } from '../../lib/utils';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  cancelLabel?: string;
  confirmLabel?: string;
  onConfirm: () => void;
}

// Diálogo de confirmación estilo shadcn para acciones destructivas.
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  cancelLabel = 'Cancelar',
  confirmLabel = 'Confirmar',
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="animate-fade-in fixed inset-0 z-50 bg-zinc-950/60" />
        <AlertDialogPrimitive.Content
          className={cn(
            'animate-fade-in fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2',
            'rounded-3xl border bg-card p-4 shadow-lg focus:outline-none',
          )}
        >
          <AlertDialogPrimitive.Title className="text-sm font-semibold">{title}</AlertDialogPrimitive.Title>
          <AlertDialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
            {description}
          </AlertDialogPrimitive.Description>
          <div className="mt-4 flex justify-end gap-2">
            <AlertDialogPrimitive.Cancel asChild>
              <button
                type="button"
                className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-full border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                {cancelLabel}
              </button>
            </AlertDialogPrimitive.Cancel>
            <AlertDialogPrimitive.Action asChild>
              <button
                type="button"
                onClick={onConfirm}
                className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white shadow transition-colors hover:bg-red-700"
              >
                {confirmLabel}
              </button>
            </AlertDialogPrimitive.Action>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
