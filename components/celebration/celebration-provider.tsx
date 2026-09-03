'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { PartyPopper } from 'lucide-react';
import { useXp } from '@/lib/hooks/useGamification';
import { celebrate } from '@/lib/celebrate';

const LEVEL_SEEN_KEY = 'yl-level-seen';

/**
 * Watches the owner's level and fires a confetti + chime celebration when it increases.
 * The last celebrated level is remembered in localStorage so a level gained while away
 * is celebrated once on the next visit, and never twice.
 */
export function CelebrationProvider({ children }: { children: React.ReactNode }) {
  const { level, isLoading, isSuccess } = useXp();
  const lastLevel = useRef<number | null>(null);

  useEffect(() => {
    if (isLoading || !isSuccess) return;
    const current = level.level;

    if (lastLevel.current === null) {
      const stored = Number(window.localStorage.getItem(LEVEL_SEEN_KEY));
      lastLevel.current = Number.isFinite(stored) && stored > 0 ? stored : current;
    }

    if (current > lastLevel.current) {
      celebrate('levelup');
      toast.success(`Level ${current} reached!`, {
        description: `You are now a ${level.title}. Keep the streak going!`,
        icon: <PartyPopper className="h-4 w-4" />,
        duration: 6000,
      });
    }

    lastLevel.current = current;
    window.localStorage.setItem(LEVEL_SEEN_KEY, String(current));
  }, [level.level, level.title, isLoading, isSuccess]);

  return <>{children}</>;
}
