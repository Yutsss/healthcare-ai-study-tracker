import { describe, expect, it } from 'vitest';
import courseSeed from '@/data/yutas-lab-course-seed.json';
import { buildDemoCurriculum } from './curriculum';
import { createDemoState, demoReducer, type DemoStateV2 } from './state';
import { deriveDemoProgression } from './progression';

const now = new Date('2026-09-04T18:00:00.000Z');
const completionTimes = [
  '2026-09-04T08:00:00.000Z',
  '2026-09-04T08:05:00.000Z',
  '2026-09-04T08:10:00.000Z',
  '2026-09-04T08:15:00.000Z',
];

function stateWithCompletedFirstCourse(): DemoStateV2 {
  return ['module-001', 'module-002', 'module-003', 'module-004'].reduce(
    (state, moduleId, index) => demoReducer(state, {
      type: 'module/status', moduleId, status: 'done', now: completionTimes[index],
    }),
    createDemoState(),
  );
}

describe('deriveDemoProgression', () => {
  it('derives zero XP, locked achievements, current quests, milestones, and no activity from a clean state', () => {
    const state = createDemoState();
    const progression = deriveDemoProgression(state, buildDemoCurriculum(courseSeed, state.moduleProgress), now);

    expect(progression.totalXp).toBe(0);
    expect(progression.level).toMatchObject({ level: 1, xp: 0, title: 'Curious Intern' });
    expect(progression.streak).toEqual({ current: 0, activeToday: false, longest: 0 });
    expect(progression.achievements).toHaveLength(32);
    expect(progression.achievements.find((item) => item.def.key === 'first_module')).toMatchObject({ current: 0, complete: false, earnedAt: null });
    expect(progression.quests.map((quest) => quest.key)).toEqual(['intervals_4', 'modules_4', 'streak_3']);
    expect(progression.quests.map((quest) => quest.current)).toEqual([0, 0, 0]);
    expect(progression.milestones).toHaveLength(4);
    expect(progression.milestones[0]).toMatchObject({ id: 'milestone-01', phasesDone: 0, percent: 0, complete: false });
    expect(progression.activity).toEqual([]);
  });

  it('uses current-week actions for quest progress and derives base XP/activity exactly once per source', () => {
    let state = stateWithCompletedFirstCourse();
    state = demoReducer(state, { type: 'log/add', log: {
      id: 'log-1', loggedOn: '2026-09-04', minutes: 25, topic: 'Data science', notes: null,
      moduleId: 'module-001', createdAt: '2026-09-04T09:00:00.000Z', source: 'focus', focusIntervals: 4,
    } });
    state = demoReducer(state, { type: 'report/add', report: {
      id: 'report-1', moduleId: 'module-001', activityTitle: 'Evaluation drill', confidence: 4, difficulty: 3,
      timeSpentMinutes: 20, whatLearned: null, struggles: null, createdAt: '2026-09-04T10:00:00.000Z',
    } });
    state = demoReducer(state, { type: 'project/save', project: {
      id: 'project-1', title: 'Triage helper', description: null, projectType: 'Portfolio', status: 'completed', tags: [],
      githubUrl: null, demoUrl: null, coverImageUrl: null, createdAt: null, updatedAt: null, startedAt: null, completedAt: null,
    }, now: '2026-09-04T11:00:00.000Z' });

    const progression = deriveDemoProgression(state, buildDemoCurriculum(courseSeed, state.moduleProgress), now);

    expect(progression.totalXp).toBe(248); // 4×20 modules + 3 log + 15 report + 150 project
    expect(progression.quests.map((quest) => [quest.key, quest.current, quest.complete])).toEqual([
      ['intervals_4', 4, true],
      ['modules_4', 4, true],
      ['streak_3', 1, false],
    ]);
    expect(progression.achievements.find((item) => item.def.key === 'first_module')).toMatchObject({ current: 4, complete: true, earnedAt: null });
    expect(progression.achievements.find((item) => item.def.key === 'first_unit')).toMatchObject({ current: 1, complete: true, earnedAt: null });
    expect(progression.activity.filter((event) => event.event_type === 'module_completed')).toHaveLength(4);
    expect(progression.activity.some((event) => event.event_type === 'study_logged')).toBe(true);
    expect(progression.activity.some((event) => event.event_type === 'exercise_reported')).toBe(true);
    expect(progression.activity.some((event) => event.event_type === 'project_completed')).toBe(true);
  });

  it('awards persisted achievement and weekly quest rewards once without duplicating aggregate state', () => {
    const state = {
      ...stateWithCompletedFirstCourse(),
      earnedAchievements: { first_module: '2026-09-04T12:00:00.000Z' },
      completedQuests: { '2026-08-31:modules_4': '2026-09-04T12:05:00.000Z' },
    };

    const progression = deriveDemoProgression(state, buildDemoCurriculum(courseSeed, state.moduleProgress), now);

    expect(progression.totalXp).toBe(170); // 80 module + 25 achievement + 65 quest
    expect(progression.xpEvents.map((event) => [event.source_type, event.amount])).toEqual([
      ['weekly_quest', 65],
      ['achievement', 25],
      ['module', 20],
      ['module', 20],
      ['module', 20],
      ['module', 20],
    ]);
    expect(progression.achievements.find((item) => item.def.key === 'first_module')?.earnedAt).toBe('2026-09-04T12:00:00.000Z');
    expect(progression.quests.find((quest) => quest.key === 'modules_4')?.completed_at).toBe('2026-09-04T12:05:00.000Z');
  });
});
