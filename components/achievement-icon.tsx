'use client';

import React from 'react';
import {
  Activity, Award, BookCheck, Boxes, Brain, CalendarCheck, ClipboardPen, Clock3, Compass, Crown, Flag, Flame,
  Footprints, Gauge, GraduationCap, Hourglass, Landmark, Layers, Library, Map, Mountain, NotebookPen, ScrollText,
  SearchCheck, Sparkles, Telescope, Timer, Trophy, Zap, type LucideIcon,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  Activity, Award, BookCheck, Boxes, Brain, CalendarCheck, ClipboardPen, Clock3, Compass, Crown, Flag, Flame,
  Footprints, Gauge, GraduationCap, Hourglass, Landmark, Layers, Library, Map, Mountain, NotebookPen, ScrollText,
  SearchCheck, Sparkles, Telescope, Timer, Trophy, Zap,
};

export function AchievementIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] || Award;
  return <Icon className={className} />;
}
