import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from './ui/button';
import { KEYS, load, save } from '../lib/storage';

export function useTheme() {
  const [dark, setDark] = React.useState<boolean>(() => {
    const stored = load<string | null>(KEYS.theme, null);
    if (stored) return stored === 'dark';
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  });

  React.useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', dark);
    save(KEYS.theme, dark ? 'dark' : 'light');
  }, [dark]);

  return { dark, toggle: () => setDark((d) => !d) };
}

export function ThemeToggle({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  return (
    <Button variant="outline" size="icon" onClick={onToggle} aria-label="Cambiar tema">
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}
