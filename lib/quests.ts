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
  { key: 'sessions_4', type: 'sessions', title: 'Four-session rhythm', description: 'Build momentum with four focused study sessions.', target: 4, xp: 55 },
  { key: 'sessions_5', type: 'sessions', title: 'Log 5 study sessions', description: 'Five focus sessions in one week.', target: 5, xp: 70 },
  { key: 'sessions_7', type: 'sessions', title: 'Seven-session sprint', description: 'Complete seven focused sessions before the weekly reset.', target: 7, xp: 100 },
  { key: 'minutes_120', type: 'minutes', title: 'Study 2 hours', description: 'Accumulate 120 minutes of focus time.', target: 120, xp: 60 },
  { key: 'minutes_180', type: 'minutes', title: 'Three-hour power-up', description: 'Charge up with 180 focused study minutes.', target: 180, xp: 80 },
  { key: 'minutes_300', type: 'minutes', title: 'Study 5 hours', description: 'Accumulate 300 minutes of focus time.', target: 300, xp: 120 },
  { key: 'minutes_420', type: 'minutes', title: 'Seven-hour deep dive', description: 'Dive deep for 420 focused minutes this week.', target: 420, xp: 150 },
  { key: 'intervals_4', type: 'focus_intervals', title: 'Pomodoro warm-up', description: 'Complete four focused Pomodoro intervals.', target: 4, xp: 35 },
  { key: 'intervals_12', type: 'focus_intervals', title: 'Pomodoro champion', description: 'Complete twelve focused Pomodoro intervals.', target: 12, xp: 90 },
  { key: 'modules_3', type: 'modules', title: 'Complete 3 modules', description: 'Mark three modules as done.', target: 3, xp: 50 },
  { key: 'modules_4', type: 'modules', title: 'Module momentum', description: 'Move four modules across the finish line.', target: 4, xp: 65 },
  { key: 'modules_6', type: 'modules', title: 'Complete 6 modules', description: 'Mark six modules as done.', target: 6, xp: 90 },
  { key: 'modules_8', type: 'modules', title: 'Eight-module expedition', description: 'Explore and complete eight modules this week.', target: 8, xp: 120 },
  { key: 'course_1', type: 'courses', title: 'Finish a course', description: 'Complete every module in one course.', target: 1, xp: 80 },
  { key: 'course_2', type: 'courses', title: 'Double course clear', description: 'Finish two complete courses in one week.', target: 2, xp: 150 },
  { key: 'reports_2', type: 'reports', title: 'Reflect twice', description: 'Log two exercise self-reports.', target: 2, xp: 40 },
  { key: 'reports_3', type: 'reports', title: 'Reflection trio', description: 'Capture three useful exercise reflections.', target: 3, xp: 60 },
  { key: 'streak_3', type: 'streak', title: 'Three-day spark', description: 'Keep a three-day learning spark alive.', target: 3, xp: 35 },
  { key: 'streak_5', type: 'streak', title: 'Keep a 5-day streak', description: 'Be active five days in a row.', target: 5, xp: 50 },
  { key: 'streak_7', type: 'streak', title: 'Seven-day flame', description: 'Stay active for a full seven-day streak.', target: 7, xp: 90 },
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

/** Seed only a brand-new week so catalogue changes never alter an active rotation. */
export function questTemplatesToCreate(weekStartKey: string, existingQuestCount: number): QuestTemplate[] {
  return existingQuestCount > 0 ? [] : questsForWeek(weekStartKey);
}

export function currentWeekStartKey(now: Date = new Date()): string {
  return dayKey(weekStart(now));
}
