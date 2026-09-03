'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SOUND_PREF_EVENT, setSoundEnabled, soundEnabled, playChime } from '@/lib/celebrate';

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === 'dark';
  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      data-testid="theme-toggle"
    >
      {mounted ? (dark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-violet-600" />) : <Moon className="h-4 w-4 opacity-0" />}
    </Button>
  );
}

export function SoundToggle({ className }: { className?: string }) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const sync = () => setOn(soundEnabled());
    sync();
    window.addEventListener(SOUND_PREF_EVENT, sync);
    return () => window.removeEventListener(SOUND_PREF_EVENT, sync);
  }, []);
  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      onClick={() => {
        const next = !on;
        setSoundEnabled(next);
        if (next) playChime('achievement');
      }}
      title={on ? 'Mute celebration sounds' : 'Unmute celebration sounds'}
      aria-label={on ? 'Mute celebration sounds' : 'Unmute celebration sounds'}
      data-testid="sound-toggle"
    >
      {on ? <Volume2 className="h-4 w-4 text-teal-600 dark:text-teal-400" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
    </Button>
  );
}
