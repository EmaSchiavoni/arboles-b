import * as React from 'react';
import { Network, PencilRuler } from 'lucide-react';
import { Button } from './components/ui/button';
import { Toaster } from './components/ui/toast';
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

  const inAuto = tab === 'auto';

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <main className="min-h-0 flex-1">
        <h1 className="sr-only">Playground de Árboles B: generá, explorá y validá árboles B</h1>
        {inAuto ? <PlayAuto key="auto" /> : <PlayManual key="manual" />}
      </main>

      <div className="fixed right-3 top-3 z-40 flex items-center gap-1 rounded-full border bg-card/95 p-1 shadow-lg backdrop-blur">
        <Button size="sm" variant="ghost" onClick={() => setTab(inAuto ? 'manual' : 'auto')} className="rounded-full">
          {inAuto ? <PencilRuler /> : <Network />}
          <span className="hidden sm:inline">{inAuto ? 'Ir a modo manual' : 'Ir a modo automático'}</span>
          <span className="sm:hidden">{inAuto ? 'Ir a manual' : 'Ir a automático'}</span>
        </Button>
        <ThemeToggle dark={dark} onToggle={toggle} />
      </div>
      <Toaster />
    </div>
  );
}
