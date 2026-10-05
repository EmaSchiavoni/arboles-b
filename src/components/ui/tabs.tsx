import * as React from 'react';
import { cn } from '../../lib/utils';

interface TabsCtx {
  value: string;
  setValue: (v: string) => void;
}
const Ctx = React.createContext<TabsCtx>({ value: '', setValue: () => {} });

export function Tabs({ value, onValueChange, children, className }: { value: string; onValueChange: (v: string) => void; children: React.ReactNode; className?: string }) {
  return (
    <Ctx.Provider value={{ value, setValue: onValueChange }}>
      <div className={cn(className)}>{children}</div>
    </Ctx.Provider>
  );
}

export function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('inline-flex h-9 items-center justify-center rounded-full bg-zinc-100 p-1 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400', className)}>
      {children}
    </div>
  );
}

export function TabsTrigger({ value, children }: { value: string; children: React.ReactNode }) {
  const { value: cur, setValue } = React.useContext(Ctx);
  const active = cur === value;
  return (
    <button
      type="button"
      onClick={() => setValue(value)}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium transition-all focus-visible:outline-none disabled:opacity-50',
        active ? 'bg-white text-zinc-950 shadow dark:bg-zinc-950 dark:text-zinc-50' : 'hover:text-zinc-900 dark:hover:text-zinc-100',
      )}
    >
      {children}
    </button>
  );
}
