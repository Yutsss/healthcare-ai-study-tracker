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
  { key: 'modules_50', title: 'Half Century', description: 'Complete 50 modules.', icon: 'Library', xp_reward: 150, metric: 'modules_done', target: 50 },
  { key: 'modules_100', title: 'Centurion', description: 'Complete 100 modules.', icon: 'Landmark', xp_reward: 300, metric: 'modules_done', target: 100 },
  { key: 'modules_all', title: 'Journey Complete', description: 'Complete every module in the curriculum.', icon: 'Crown', xp_reward: 1000, metric: 'modules_done', target: 265 },
  { key: 'first_unit', title: 'Course Closer', description: 'Finish your first course.', icon: 'GraduationCap', xp_reward: 50, metric: 'units_done', target: 1 },
  { key: 'units_10', title: 'Serial Finisher', description: 'Finish 10 courses.', icon: 'Layers', xp_reward: 200, metric: 'units_done', target: 10 },
  { key: 'first_phase', title: 'Phase Master', description: 'Complete an entire phase.', icon: 'Flag', xp_reward: 200, metric: 'phases_done', target: 1 },
  { key: 'phases_5', title: 'Foundation Built', description: 'Complete 5 phases.', icon: 'Mountain', xp_reward: 500, metric: 'phases_done', target: 5 },
  { key: 'first_report', title: 'Self-Aware', description: 'Log your first exercise self-report.', icon: 'ClipboardPen', xp_reward: 20, metric: 'reports', target: 1 },
  { key: 'reports_10', title: 'Reflective Practitioner', description: 'Log 10 exercise reports.', icon: 'NotebookPen', xp_reward: 75, metric: 'reports', target: 10 },
  { key: 'reports_50', title: 'Deep Reflection', description: 'Log 50 exercise reports.', icon: 'Brain', xp_reward: 200, metric: 'reports', target: 50 },
  { key: 'first_log', title: 'Clocked In', description: 'Log your first study session.', icon: 'Timer', xp_reward: 10, metric: 'logs', target: 1 },
  { key: 'minutes_600', title: 'Ten Hours', description: 'Study for 10 hours in total.', icon: 'Hourglass', xp_reward: 100, metric: 'minutes', target: 600 },
  { key: 'minutes_3000', title: 'Fifty Hours', description: 'Study for 50 hours in total.', icon: 'Hourglass', xp_reward: 300, metric: 'minutes', target: 3000 },
  { key: 'streak_3', title: 'Warming Up', description: 'Reach a 3-day streak.', icon: 'Flame', xp_reward: 30, metric: 'streak', target: 3 },
  { key: 'streak_7', title: 'On Fire', description: 'Reach a 7-day streak.', icon: 'Flame', xp_reward: 75, metric: 'streak', target: 7 },
  { key: 'streak_30', title: 'Unstoppable', description: 'Reach a 30-day streak.', icon: 'Flame', xp_reward: 300, metric: 'streak', target: 30 },
  { key: 'level_5', title: 'Rising Star', description: 'Reach level 5.', icon: 'Zap', xp_reward: 100, metric: 'level', target: 5 },
  { key: 'level_10', title: 'Veteran', description: 'Reach level 10.', icon: 'Trophy', xp_reward: 250, metric: 'level', target: 10 },
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
