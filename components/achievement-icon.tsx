'use client';

import {
  BookCheck, Brain, ClipboardPen, Crown, Flag, Flame, Footprints, GraduationCap, Hourglass, Landmark, Layers, Library,
  Mountain, NotebookPen, Timer, Trophy, Zap, Award, type LucideIcon,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  BookCheck, Brain, ClipboardPen, Crown, Flag, Flame, Footprints, GraduationCap, Hourglass, Landmark, Layers, Library,
  Mountain, NotebookPen, Timer, Trophy, Zap,
};

export function AchievementIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] || Award;
  return <Icon className={className} />;
}
