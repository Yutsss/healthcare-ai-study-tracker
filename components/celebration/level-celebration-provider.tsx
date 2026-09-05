'use client';

import React, { useEffect, useRef } from 'react';
import { PartyPopper } from 'lucide-react';
import { toast } from 'sonner';
import { celebrate } from '@/lib/celebrate';
import type { LevelInfo } from '@/lib/gamification';

/** Watches an injected level without loading any user data itself. */
export function LevelCelebrationProvider({
  level,
  enabled = true,
  storageKey,
  children,
}: {
  level: LevelInfo;
  enabled?: boolean;
  storageKey?: string;
  children: React.ReactNode;
}) {
  const lastLevel = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const current = level.level;

    if (lastLevel.current === null) {
      const stored = storageKey ? Number(window.localStorage.getItem(storageKey)) : Number.NaN;
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
    if (storageKey) window.localStorage.setItem(storageKey, String(current));
  }, [enabled, level.level, level.title, storageKey]);

  return <>{children}</>;
}
