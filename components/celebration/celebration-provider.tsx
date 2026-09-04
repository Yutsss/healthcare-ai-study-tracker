'use client';

import React, { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { PartyPopper } from 'lucide-react';
import { useXp } from '@/lib/hooks/useGamification';
import { celebrate } from '@/lib/celebrate';
import type { LevelInfo } from '@/lib/gamification';

const LEVEL_SEEN_KEY = 'yl-level-seen';

/**
 * Watches the owner's level and fires a confetti + chime celebration when it increases.
 * The last celebrated level is remembered in localStorage so a level gained while away
 * is celebrated once on the next visit, and never twice.
 */
function LevelCelebrationObserver({
  level,
  enabled,
  storageKey,
}: {
  level: LevelInfo;
  enabled: boolean;
  storageKey?: string;
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

  return null;
}

export function CelebrationProvider({ children }: { children: React.ReactNode }) {
  const { level, isLoading, isSuccess } = useXp();

  return <><LevelCelebrationObserver level={level} enabled={!isLoading && isSuccess} storageKey={LEVEL_SEEN_KEY} />{children}</>;
}

/** Observes demo progression without loading or persisting any owner data. */
export function DemoCelebrationProvider({ level, children }: { level: LevelInfo; children: React.ReactNode }) {
  return <><LevelCelebrationObserver level={level} enabled />{children}</>;
}
