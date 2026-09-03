import { weekStart, dayKey } from '@/lib/week';

export type QuestType = 'sessions' | 'minutes' | 'modules' | 'courses' | 'reports' | 'streak' | 'focus_intervals';

export type QuestTemplate = {
  key: string;
  type: QuestType;
  title: string;
  description: string;
  target: number;
  xp: number;
};

/** Pool of quests. Three are chosen deterministically for each week (fresh every Monday). */
export const QUEST_POOL: QuestTemplate[] = [
  { key: 'sessions_3', type: 'sessions', title: 'Log 3 study sessions', description: 'Complete three focus sessions this week.', target: 3, xp: 40 },
  { key: 'sessions_5', type: 'sessions', title: 'Log 5 study sessions', description: 'Five focus sessions in one week.', target: 5, xp: 70 },
  { key: 'minutes_120', type: 'minutes', title: 'Study 2 hours', description: 'Accumulate 120 minutes of focus time.', target: 120, xp: 60 },
  { key: 'minutes_300', type: 'minutes', title: 'Study 5 hours', description: 'Accumulate 300 minutes of focus time.', target: 300, xp: 120 },
  { key: 'modules_3', type: 'modules', title: 'Complete 3 modules', description: 'Mark three modules as done.', target: 3, xp: 50 },
  { key: 'modules_6', type: 'modules', title: 'Complete 6 modules', description: 'Mark six modules as done.', target: 6, xp: 90 },
  { key: 'course_1', type: 'courses', title: 'Finish a course', description: 'Complete every module in one course.', target: 1, xp: 80 },
  { key: 'reports_2', type: 'reports', title: 'Reflect twice', description: 'Log two exercise self-reports.', target: 2, xp: 40 },
  { key: 'streak_5', type: 'streak', title: 'Keep a 5-day streak', description: 'Be active five days in a row.', target: 5, xp: 50 },
  { key: 'intervals_8', type: 'focus_intervals', title: 'Finish 8 Pomodoros', description: 'Complete eight focus intervals.', target: 8, xp: 60 },
];

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Deterministic pick of 3 quests (one "time" quest, one "progress" quest, one wildcard) for a week. */
export function questsForWeek(weekStartKey: string): QuestTemplate[] {
  const seed = hash(weekStartKey);
  const time = QUEST_POOL.filter((q) => q.type === 'sessions' || q.type === 'minutes' || q.type === 'focus_intervals');
  const progress = QUEST_POOL.filter((q) => q.type === 'modules' || q.type === 'courses');
  const wild = QUEST_POOL.filter((q) => q.type === 'reports' || q.type === 'streak');
  const pick = <T,>(arr: T[], salt: number) => arr[(seed + salt * 7919) % arr.length];
  return [pick(time, 1), pick(progress, 2), pick(wild, 3)];
}

export function currentWeekStartKey(now: Date = new Date()): string {
  return dayKey(weekStart(now));
}
