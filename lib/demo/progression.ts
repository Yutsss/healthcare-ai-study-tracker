import courseSeed from '@/data/yutas-lab-course-seed.json';
import { ACHIEVEMENTS, achievementProgress, type AchievementStats } from '@/lib/achievements';
import type { CurriculumTree, ModuleNode, PhaseNode, UnitNode } from '@/lib/curriculum';
import { computeStreak, levelFromXp, studyLogXp } from '@/lib/gamification';
import type {
  LabActivityEvent,
  LabMilestoneView,
  LabProgressionView,
  LabQuestView,
  LabXpEvent,
} from '@/lib/lab/types';
import { currentWeekStartKey, questsForWeek, type QuestType } from '@/lib/quests';
import { MILESTONE_PHASE_MAP } from '@/lib/seed/milestoneMap';
import { dayKey, weekDayKeys } from '@/lib/week';
import type { DemoStateV2 } from './state';

export type DemoProgression = LabProgressionView;

function eventDate(value: string | null | undefined): string | null {
  return value && Number.isFinite(Date.parse(value)) ? value : null;
}

function moduleIndex(tree: CurriculumTree): Map<string, { module: ModuleNode; unit: UnitNode; phase: PhaseNode }> {
  const index = new Map<string, { module: ModuleNode; unit: UnitNode; phase: PhaseNode }>();
  for (const phase of tree.phases) {
    for (const unit of phase.units) {
      for (const module of unit.modules) index.set(module.id, { module, unit, phase });
    }
  }
  return index;
}

function uniqueXpEvents(events: LabXpEvent[]): LabXpEvent[] {
  const unique = new Map<string, LabXpEvent>();
  for (const event of events) {
    const key = `${event.source_type}:${event.source_id ?? event.id}`;
    const current = unique.get(key);
    if (!current || current.created_at < event.created_at) unique.set(key, event);
  }
  return [...unique.values()].sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id));
}

function xpEvents(state: DemoStateV2, tree: CurriculumTree): LabXpEvent[] {
  const modules = moduleIndex(tree);
  const events: LabXpEvent[] = [];

  for (const [moduleId, progress] of Object.entries(state.moduleProgress)) {
    const completedAt = eventDate(progress.completedAt);
    const item = modules.get(moduleId);
    if (progress.status !== 'done' || !completedAt || !item) continue;
    events.push({
      id: `demo-xp:module:${moduleId}`,
      amount: item.module.xp_value,
      source_type: 'module',
      source_id: moduleId,
      reason: `Completed module: ${item.module.title}`,
      created_at: completedAt,
    });
  }

  for (const log of state.logs) {
    events.push({
      id: `demo-xp:study-log:${log.id}`,
      amount: studyLogXp(log.minutes),
      source_type: 'study_log',
      source_id: log.id,
      reason: `Study log: ${log.minutes} minutes`,
      created_at: log.createdAt,
    });
  }

  for (const report of state.reports) {
    events.push({
      id: `demo-xp:exercise-report:${report.id}`,
      amount: 15,
      source_type: 'exercise_report',
      source_id: report.id,
      reason: 'Exercise self-report',
      created_at: report.createdAt,
    });
  }

  for (const project of state.projects) {
    const completedAt = eventDate(project.completedAt);
    if (project.status !== 'completed' || !completedAt) continue;
    events.push({
      id: `demo-xp:project:${project.id}`,
      amount: 150,
      source_type: 'project',
      source_id: project.id,
      reason: `Completed project: ${project.title}`,
      created_at: completedAt,
    });
  }

  for (const [key, earnedAt] of Object.entries(state.earnedAchievements)) {
    const definition = ACHIEVEMENTS.find((item) => item.key === key);
    if (!definition || !eventDate(earnedAt)) continue;
    events.push({
      id: `demo-xp:achievement:${key}`,
      amount: definition.xp_reward,
      source_type: 'achievement',
      source_id: key,
      reason: `Achievement unlocked: ${definition.title}`,
      created_at: earnedAt,
    });
  }

  for (const [marker, completedAt] of Object.entries(state.completedQuests)) {
    const separator = marker.indexOf(':');
    if (separator < 1 || !eventDate(completedAt)) continue;
    const weekStart = marker.slice(0, separator);
    const key = marker.slice(separator + 1);
    const quest = questsForWeek(weekStart).find((item) => item.key === key);
    if (!quest) continue;
    events.push({
      id: `demo-xp:weekly-quest:${marker}`,
      amount: quest.xp,
      source_type: 'weekly_quest',
      source_id: marker,
      reason: `Weekly quest complete: ${quest.title}`,
      created_at: completedAt,
    });
  }

  return uniqueXpEvents(events);
}

function milestoneViews(tree: CurriculumTree): LabMilestoneView[] {
  const phaseByKey = new Map(tree.phases.map((phase) => [phase.key, phase] as const));
  return courseSeed.milestones.map((milestone, index) => {
    const phases = (MILESTONE_PHASE_MAP[milestone.id] ?? []).flatMap((key) => {
      const phase = phaseByKey.get(key);
      return phase ? [phase] : [];
    });
    const phasesDone = phases.filter((phase) => phase.status === 'completed').length;
    const complete = phases.length > 0 && phasesDone === phases.length;
    const completionDates = phases.flatMap((phase) => phase.units)
      .flatMap((unit) => unit.modules)
      .map((module) => module.progress?.completed_at)
      .filter((value): value is string => Boolean(eventDate(value)));
    return {
      id: milestone.id,
      key: milestone.id,
      title: milestone.title,
      description: milestone.competency_criteria ?? null,
      sort_order: milestone.order ?? index + 1,
      achieved_at: complete && completionDates.length ? completionDates.sort().at(-1) ?? null : null,
      phases,
      phasesDone,
      percent: phases.length ? Math.round(phases.reduce((sum, phase) => sum + phase.percent, 0) / phases.length) : 0,
      complete,
      index: index + 1,
    };
  });
}

function questViews(state: DemoStateV2, tree: CurriculumTree, streak: DemoProgression['streak'], now: Date): LabQuestView[] {
  const days = new Set(weekDayKeys(now));
  const weekStart = currentWeekStartKey(now);
  const logs = state.logs.filter((log) => days.has(log.loggedOn));
  const reports = state.reports.filter((report) => days.has(dayKey(new Date(report.createdAt))));
  const completedModules = tree.phases.flatMap((phase) => phase.units).flatMap((unit) => unit.modules)
    .filter((module) => module.status === 'done' && module.progress?.completed_at && days.has(dayKey(new Date(module.progress.completed_at))));
  const completedCourses = tree.phases.flatMap((phase) => phase.units).filter((unit) => {
    if (unit.status !== 'completed' || unit.modules.length === 0) return false;
    const dates = unit.modules.map((module) => module.progress?.completed_at).filter((value): value is string => Boolean(value));
    return dates.length === unit.modules.length && dates.some((value) => days.has(dayKey(new Date(value))));
  });
  const metrics: Record<QuestType, number> = {
    sessions: logs.length,
    minutes: logs.reduce((sum, log) => sum + log.minutes, 0),
    focus_intervals: logs.reduce((sum, log) => sum + (log.focusIntervals ?? 0), 0),
    modules: completedModules.length,
    courses: completedCourses.length,
    reports: reports.length,
    streak: streak.current,
  };

  return questsForWeek(weekStart).map((template) => {
    const marker = `${weekStart}:${template.key}`;
    const completedAt = state.completedQuests[marker] ?? null;
    const current = metrics[template.type];
    return {
      id: marker,
      week_start: weekStart,
      key: template.key,
      title: template.title,
      description: template.description,
      quest_type: template.type,
      target: template.target,
      progress: Math.min(template.target, current),
      xp_reward: template.xp,
      completed_at: completedAt,
      current,
      ratio: Math.min(1, current / Math.max(1, template.target)),
      complete: Boolean(completedAt) || current >= template.target,
      template,
    };
  });
}

function activityEvents(state: DemoStateV2, tree: CurriculumTree): LabActivityEvent[] {
  const modules = moduleIndex(tree);
  const events: LabActivityEvent[] = [];
  for (const [moduleId, progress] of Object.entries(state.moduleProgress)) {
    const item = modules.get(moduleId);
    const createdAt = progress.status === 'done' ? progress.completedAt : progress.updatedAt;
    if (!item || !createdAt) continue;
    events.push({
      id: `demo-activity:module:${moduleId}:${progress.status}`,
      event_type: progress.status === 'done' ? 'module_completed' : 'module_status_changed',
      entity_type: 'module',
      entity_id: moduleId,
      payload: { title: item.module.title, status: progress.status },
      created_at: createdAt,
    });
  }
  for (const log of state.logs) events.push({
    id: `demo-activity:study-log:${log.id}`,
    event_type: 'study_logged', entity_type: 'study_log', entity_id: log.id,
    payload: { minutes: log.minutes, topic: log.topic }, created_at: log.createdAt,
  });
  for (const report of state.reports) events.push({
    id: `demo-activity:exercise-report:${report.id}`,
    event_type: 'exercise_reported', entity_type: 'exercise_report', entity_id: report.id,
    payload: { activity_title: report.activityTitle, module_title: modules.get(report.moduleId)?.module.title }, created_at: report.createdAt,
  });
  for (const project of state.projects) {
    const createdAt = project.status === 'completed' && project.completedAt ? project.completedAt : project.updatedAt ?? project.createdAt;
    if (!createdAt) continue;
    events.push({
      id: `demo-activity:project:${project.id}:${project.status}`,
      event_type: project.status === 'completed' ? 'project_completed' : project.createdAt === project.updatedAt ? 'project_created' : 'project_status_changed',
      entity_type: 'project', entity_id: project.id,
      payload: { title: project.title, status: project.status }, created_at: createdAt,
    });
  }
  for (const [key, createdAt] of Object.entries(state.earnedAchievements)) {
    const definition = ACHIEVEMENTS.find((item) => item.key === key);
    if (definition) events.push({
      id: `demo-activity:achievement:${key}`, event_type: 'achievement_earned', entity_type: 'achievement', entity_id: key,
      payload: { title: definition.title, xp: definition.xp_reward }, created_at: createdAt,
    });
  }
  for (const [marker, createdAt] of Object.entries(state.completedQuests)) {
    const separator = marker.indexOf(':');
    const weekStart = marker.slice(0, separator);
    const key = marker.slice(separator + 1);
    const quest = separator > 0 ? questsForWeek(weekStart).find((item) => item.key === key) : undefined;
    if (quest) events.push({
      id: `demo-activity:weekly-quest:${marker}`, event_type: 'quest_completed', entity_type: 'weekly_quest', entity_id: marker,
      payload: { title: quest.title, xp: quest.xp }, created_at: createdAt,
    });
  }
  return events.sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id));
}

export function deriveDemoProgression(
  state: DemoStateV2,
  tree: CurriculumTree,
  now: Date = new Date(),
): DemoProgression {
  const activity = activityEvents(state, tree);
  const streak = computeStreak(activity.map((event) => event.created_at), now);
  const events = xpEvents(state, tree);
  const totalXp = events.reduce((sum, event) => sum + event.amount, 0);
  const level = levelFromXp(totalXp);
  const stats: AchievementStats = {
    modules_done: tree.totals.modulesDone,
    units_done: tree.totals.unitsDone,
    phases_done: tree.totals.phasesDone,
    reports: state.reports.length,
    logs: state.logs.length,
    minutes: state.logs.reduce((sum, log) => sum + log.minutes, 0)
      + state.reports.reduce((sum, report) => sum + (report.timeSpentMinutes ?? 0), 0),
    streak: Math.max(streak.current, streak.longest),
    level: level.level,
  };
  const achievements = ACHIEVEMENTS.map((definition) => ({
    ...achievementProgress(definition, stats),
    id: definition.key,
    earnedAt: state.earnedAchievements[definition.key] ?? null,
    complete: Boolean(state.earnedAchievements[definition.key]) || achievementProgress(definition, stats).complete,
  }));

  return {
    xpEvents: events,
    totalXp,
    level,
    streak,
    achievements,
    quests: questViews(state, tree, streak, now),
    milestones: milestoneViews(tree),
    activity,
  };
}
