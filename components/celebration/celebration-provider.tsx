'use client';

import React from 'react';
import { useXp } from '@/lib/hooks/useGamification';
import { LevelCelebrationProvider } from './level-celebration-provider';

const LEVEL_SEEN_KEY = 'yl-level-seen';

/** Watches owner XP and remembers the last celebrated owner level. */
export function CelebrationProvider({ children }: { children: React.ReactNode }) {
  const { level, isLoading, isSuccess } = useXp();

  return <LevelCelebrationProvider level={level} enabled={!isLoading && isSuccess} storageKey={LEVEL_SEEN_KEY}>{children}</LevelCelebrationProvider>;
}
