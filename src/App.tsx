import * as React from 'react';
import { Network, PencilRuler } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from './components/ui/tabs';
import { ThemeToggle, useTheme } from './components/ThemeToggle';
import { PlayAuto } from './routes/PlayAuto';
import { PlayManual } from './routes/PlayManual';

export default function App() {
  const { dark, toggle } = useTheme();
  const [tab, setTab] = React.useState<string>(() => localStorage.getItem('arboles-b:tab') ?? 'auto');

  React.useEffect(() => {
    try {
      localStorage.setItem('arboles-b:tab', tab);
    } catch {
      // noop
    }
  }, [tab]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-2 px-3 py-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900">
              <Network className="size-4" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold leading-tight">Árboles B · Playground</h1>
              <p className="truncate text-xs text-muted-foreground">orden p = punteros por nodo</p>
            </div>
          </div>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="auto">
                <span className="hidden sm:inline">Automático</span>
                <span className="sm:hidden">Auto</span>
              </TabsTrigger>
              <TabsTrigger value="manual">
                <span className="hidden sm:inline">Manual</span>
                <span className="sm:hidden flex items-center gap-1"><PencilRuler className="size-3.5" />Manual</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <ThemeToggle dark={dark} onToggle={toggle} />
        </div>
      </header>

      <main>
        {tab === 'auto' ? <PlayAuto key="auto" /> : <PlayManual key="manual" />}
      </main>

      <footer className="border-t">
        <p className="mx-auto w-full max-w-5xl px-3 py-4 pb-24 text-center text-xs text-muted-foreground">
          Hecho para practicar Árboles B. Todo queda en tu navegador (localStorage), no hay servidor.
        </p>
      </footer>
    </div>
  );
}
