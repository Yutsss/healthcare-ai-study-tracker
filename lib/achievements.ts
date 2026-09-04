export type AchievementMetric = 'modules_done' | 'units_done' | 'phases_done' | 'reports' | 'logs' | 'minutes' | 'streak' | 'level';

export type AchievementDef = {
  key: string;
  title: string;
  description: string;
  icon: string; // lucide icon name, resolved in UI
  xp_reward: number;
  metric: AchievementMetric;
  target: number;
};

export type AchievementStats = Record<AchievementMetric, number>;

export const ACHIEVEMENTS: AchievementDef[] = [
  { key: 'first_module', title: 'First Steps', description: 'Complete your first module.', icon: 'Footprints', xp_reward: 25, metric: 'modules_done', target: 1 },
  { key: 'modules_10', title: 'Ten Down', description: 'Complete 10 modules.', icon: 'BookCheck', xp_reward: 50, metric: 'modules_done', target: 10 },
  { key: 'modules_25', title: 'Momentum Maker', description: 'Complete 25 modules and keep the learning flywheel moving.', icon: 'Gauge', xp_reward: 100, metric: 'modules_done', target: 25 },
  { key: 'modules_50', title: 'Half Century', description: 'Complete 50 modules.', icon: 'Library', xp_reward: 150, metric: 'modules_done', target: 50 },
  { key: 'modules_100', title: 'Centurion', description: 'Complete 100 modules.', icon: 'Landmark', xp_reward: 300, metric: 'modules_done', target: 100 },
  { key: 'modules_200', title: 'Neural Marathon', description: 'Complete 200 modules in your healthcare AI marathon.', icon: 'Activity', xp_reward: 600, metric: 'modules_done', target: 200 },
  { key: 'modules_all', title: 'Journey Complete', description: 'Complete every module in the curriculum.', icon: 'Crown', xp_reward: 1000, metric: 'modules_done', target: 265 },
  { key: 'first_unit', title: 'Course Closer', description: 'Finish your first course.', icon: 'GraduationCap', xp_reward: 50, metric: 'units_done', target: 1 },
  { key: 'units_5', title: 'Course Collector', description: 'Finish 5 courses and start a serious knowledge collection.', icon: 'Boxes', xp_reward: 120, metric: 'units_done', target: 5 },
  { key: 'units_10', title: 'Serial Finisher', description: 'Finish 10 courses.', icon: 'Layers', xp_reward: 200, metric: 'units_done', target: 10 },
  { key: 'units_25', title: 'Knowledge Cartographer', description: 'Finish 25 courses and map a path across the curriculum.', icon: 'Map', xp_reward: 350, metric: 'units_done', target: 25 },
  { key: 'first_phase', title: 'Phase Master', description: 'Complete an entire phase.', icon: 'Flag', xp_reward: 200, metric: 'phases_done', target: 1 },
  { key: 'phases_5', title: 'Foundation Built', description: 'Complete 5 phases.', icon: 'Mountain', xp_reward: 500, metric: 'phases_done', target: 5 },
  { key: 'phases_10', title: 'Double-Digit Explorer', description: 'Complete 10 phases and enter the advanced stretch.', icon: 'Telescope', xp_reward: 750, metric: 'phases_done', target: 10 },
  { key: 'phases_all', title: 'Clinical AI Pathfinder', description: 'Complete all 14 phases of the learning journey.', icon: 'Compass', xp_reward: 1000, metric: 'phases_done', target: 14 },
  { key: 'first_report', title: 'Self-Aware', description: 'Log your first exercise self-report.', icon: 'ClipboardPen', xp_reward: 20, metric: 'reports', target: 1 },
  { key: 'reports_10', title: 'Reflective Practitioner', description: 'Log 10 exercise reports.', icon: 'NotebookPen', xp_reward: 75, metric: 'reports', target: 10 },
  { key: 'reports_25', title: 'Insight Detective', description: 'Log 25 reflections and hunt for patterns in your practice.', icon: 'SearchCheck', xp_reward: 150, metric: 'reports', target: 25 },
  { key: 'reports_50', title: 'Deep Reflection', description: 'Log 50 exercise reports.', icon: 'Brain', xp_reward: 200, metric: 'reports', target: 50 },
  { key: 'first_log', title: 'Clocked In', description: 'Log your first study session.', icon: 'Timer', xp_reward: 10, metric: 'logs', target: 1 },
  { key: 'logs_10', title: 'Study Regular', description: 'Log 10 study sessions and make showing up a habit.', icon: 'CalendarCheck', xp_reward: 50, metric: 'logs', target: 10 },
  { key: 'logs_50', title: 'Session Sage', description: 'Log 50 study sessions with steady intention.', icon: 'ScrollText', xp_reward: 200, metric: 'logs', target: 50 },
  { key: 'minutes_600', title: 'Ten Hours', description: 'Study for 10 hours in total.', icon: 'Hourglass', xp_reward: 100, metric: 'minutes', target: 600 },
  { key: 'minutes_1200', title: 'Twenty-Hour Hero', description: 'Study for 20 focused hours in total.', icon: 'Clock3', xp_reward: 180, metric: 'minutes', target: 1200 },
  { key: 'minutes_3000', title: 'Fifty Hours', description: 'Study for 50 hours in total.', icon: 'Hourglass', xp_reward: 300, metric: 'minutes', target: 3000 },
  { key: 'streak_3', title: 'Warming Up', description: 'Reach a 3-day streak.', icon: 'Flame', xp_reward: 30, metric: 'streak', target: 3 },
  { key: 'streak_7', title: 'On Fire', description: 'Reach a 7-day streak.', icon: 'Flame', xp_reward: 75, metric: 'streak', target: 7 },
  { key: 'streak_14', title: 'Two-Week Torch', description: 'Keep the learning flame alive for 14 days.', icon: 'Flame', xp_reward: 150, metric: 'streak', target: 14 },
  { key: 'streak_30', title: 'Unstoppable', description: 'Reach a 30-day streak.', icon: 'Flame', xp_reward: 300, metric: 'streak', target: 30 },
  { key: 'level_5', title: 'Rising Star', description: 'Reach level 5.', icon: 'Zap', xp_reward: 100, metric: 'level', target: 5 },
  { key: 'level_10', title: 'Veteran', description: 'Reach level 10.', icon: 'Trophy', xp_reward: 250, metric: 'level', target: 10 },
  { key: 'level_15', title: 'Lab Luminary', description: 'Reach level 15 and light the way for your next challenge.', icon: 'Sparkles', xp_reward: 400, metric: 'level', target: 15 },
];

export type AchievementProgress = {
  def: AchievementDef;
  current: number;
  target: number;
  ratio: number; // 0..1
  complete: boolean;
};

export function achievementProgress(def: AchievementDef, stats: AchievementStats): AchievementProgress {
  const current = stats[def.metric] ?? 0;
  const ratio = Math.max(0, Math.min(1, current / def.target));
  return { def, current, target: def.target, ratio, complete: current >= def.target };
}
