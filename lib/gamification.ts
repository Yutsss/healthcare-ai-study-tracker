export type LevelInfo = {
  level: number;
  xp: number;
  title: string;
  currentFloor: number;
  nextAt: number;
  progress: number; // 0..1 toward next level
  remaining: number;
};

const LEVEL_TITLES: Array<[number, string]> = [
  [1, 'Curious Intern'],
  [3, 'Data Resident'],
  [5, 'ML Practitioner'],
  [8, 'Clinical AI Engineer'],
  [11, 'Healthcare AI Specialist'],
  [15, 'Chief AI Scientist'],
];

/** XP required to reach a level: 100 * (level-1)^2  ->  L2=100, L3=400, L4=900 ... */
export function xpForLevel(level: number): number {
  return 100 * Math.pow(Math.max(0, level - 1), 2);
}

/** XP for a study log, mirrors the database trigger (1 XP / 10 min, min 1, max 30). */
export function studyLogXp(minutes: number): number {
  return Math.min(30, Math.max(1, Math.ceil(minutes / 10)));
}

export const EXERCISE_REPORT_XP = 15;

export function levelFromXp(xpRaw: number): LevelInfo {
  const xp = Math.max(0, Math.floor(xpRaw || 0));
  const level = Math.floor(Math.sqrt(xp / 100)) + 1;
  const currentFloor = xpForLevel(level);
  const nextAt = xpForLevel(level + 1);
  const span = nextAt - currentFloor;
  let title = LEVEL_TITLES[0][1];
  for (const [min, t] of LEVEL_TITLES) if (level >= min) title = t;
  return {
    level, xp, title, currentFloor, nextAt,
    progress: span > 0 ? (xp - currentFloor) / span : 1,
    remaining: Math.max(0, nextAt - xp),
  };
}

export function localDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Streak = consecutive active days ending today (or yesterday, if today has no activity yet).
 * `dates` may be ISO timestamps or YYYY-MM-DD strings.
 */
export function computeStreak(dates: string[], now: Date = new Date()): { current: number; activeToday: boolean; longest: number } {
  const days = new Set<string>();
  for (const d of dates) {
    if (!d) continue;
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) days.add(d);
    else days.add(localDayKey(new Date(d)));
  }
  const todayKey = localDayKey(now);
  const activeToday = days.has(todayKey);

  const cursor = new Date(now);
  if (!activeToday) cursor.setDate(cursor.getDate() - 1);
  let current = 0;
  while (days.has(localDayKey(cursor))) {
    current++;
    cursor.setDate(cursor.getDate() - 1);
  }

  // longest streak
  const sorted = Array.from(days).sort();
  let longest = 0, run = 0, prev: Date | null = null;
  for (const k of sorted) {
    const d = new Date(k + 'T00:00:00');
    if (prev && (d.getTime() - prev.getTime()) / 86400000 === 1) run++;
    else run = 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  return { current, activeToday, longest };
}
