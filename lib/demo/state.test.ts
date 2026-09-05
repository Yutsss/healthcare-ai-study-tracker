import { describe, expect, it } from 'vitest';
import {
  calculateDemoStats,
  createDemoState,
  demoReducer,
  loadDemoState,
  parseDemoState,
  resetDemoState,
  saveDemoState,
  type DemoLog,
  type DemoProject,
  type DemoStateV2,
  type DemoStorage,
} from './state';
import {
  DEMO_FOCUS_STORAGE_KEY,
  DEMO_STORAGE_KEY,
  LEGACY_DEMO_STORAGE_KEY,
} from './storage-keys';

class MemoryStorage implements DemoStorage {
  private readonly values = new Map<string, string>();

  constructor(entries: Record<string, string> = {}) {
    Object.entries(entries).forEach(([key, value]) => this.values.set(key, value));
  }

  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

const allowedModuleIds = new Set(['module-a', 'module-b']);
const validLog: DemoLog = {
  id: 'log-1', loggedOn: '2026-09-03', minutes: 25, topic: 'Clinical AI', notes: 'Reviewed model evaluation.',
  moduleId: 'module-a', createdAt: '2026-09-03T10:00:00.000Z',
};
const validProject: DemoProject = {
  id: 'project-1', title: 'Triage helper', description: 'A safe portfolio project.', projectType: 'Portfolio',
  status: 'planned', tags: ['Python'], githubUrl: 'https://github.com/example/triage',
  demoUrl: 'https://example.com/triage', coverImageUrl: null,
  createdAt: '2026-09-01T10:00:00.000Z', updatedAt: '2026-09-02T10:00:00.000Z',
  startedAt: null, completedAt: null,
};

describe('v2 demo state parsing', () => {
  it.each([null, '{not json', JSON.stringify({ schemaVersion: 99 })])('returns a clean v2 state for corrupt or obsolete saved data', (serialized) => {
    expect(parseDemoState(serialized, allowedModuleIds)).toEqual(createDemoState());
  });

  it('starts with zero progress, empty activity sources, default settings, and bounded starter projects', () => {
    const state = createDemoState([{ id: 'starter-1', title: 'Triage helper', type: 'Portfolio', skills: ['Python'] }]);

    expect(state).toEqual({
      schemaVersion: 2,
      moduleProgress: {},
      logs: [],
      reports: [],
      projects: [{
        id: 'starter-1', title: 'Triage helper', description: null, projectType: 'Portfolio', status: 'idea',
        tags: ['Python'], githubUrl: null, demoUrl: null, coverImageUrl: null,
        createdAt: null, updatedAt: null, startedAt: null, completedAt: null,
      }],
      settings: { weeklyGoalMinutes: 300, focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, longBreakEvery: 4 },
      earnedAchievements: {},
      completedQuests: {},
    });
  });

  it('migrates valid v1 data without inventing progress timestamps or project activity', () => {
    const migrated = parseDemoState(JSON.stringify({
      schemaVersion: 1,
      moduleStatusOverrides: { 'module-a': 'done', unknown: 'learning' },
      logs: [validLog],
      projects: [{
        id: 'legacy-project', title: 'Legacy project', description: null, projectType: null, status: 'completed',
        tags: [], githubUrl: null, demoUrl: null, coverImageUrl: null,
      }],
    }), allowedModuleIds);

    expect(migrated.moduleProgress).toEqual({
      'module-a': { status: 'done', startedAt: null, completedAt: null, updatedAt: null },
    });
    expect(migrated.logs).toEqual([validLog]);
    expect(migrated.projects[0]).toMatchObject({
      id: 'legacy-project', status: 'completed', createdAt: null, updatedAt: null, startedAt: null, completedAt: null,
    });
    expect(migrated.reports).toEqual([]);
    expect(migrated.earnedAchievements).toEqual({});
    expect(migrated.completedQuests).toEqual({});
  });

  it('retains only known modules and sanitizes progress, reports, settings, markers, text, and URLs', () => {
    const parsed = parseDemoState(JSON.stringify({
      schemaVersion: 2,
      moduleProgress: {
        'module-a': { status: 'done', startedAt: 'bad-date', completedAt: '2026-09-04T08:00:00.000Z', updatedAt: '2026-09-04T08:00:00.000Z' },
        'module-b': { status: 'published' },
        unknown: { status: 'learning', updatedAt: '2026-09-04T08:00:00.000Z' },
      },
      logs: [validLog, { ...validLog, id: 'bad-log', minutes: 0 }],
      reports: [{
        id: 'report-1', moduleId: 'module-a', activityTitle: 'x'.repeat(250), confidence: 5, difficulty: 0,
        timeSpentMinutes: 1441, whatLearned: 'w'.repeat(5000), struggles: null, createdAt: '2026-09-04T09:00:00.000Z',
      }, {
        id: 'report-2', moduleId: 'unknown', activityTitle: null, confidence: 3, difficulty: 3,
        timeSpentMinutes: 30, whatLearned: null, struggles: null, createdAt: '2026-09-04T09:00:00.000Z',
      }],
      projects: [{ ...validProject, githubUrl: 'javascript:alert(1)', coverImageUrl: 'data:text/html,unsafe' }],
      settings: { weeklyGoalMinutes: 99999, focusMinutes: 0, shortBreakMinutes: 999, longBreakMinutes: 15.4, longBreakEvery: 99 },
      earnedAchievements: { first_module: '2026-09-04T10:00:00.000Z', bad: 'not-a-date' },
      completedQuests: { modules_3: '2026-09-04T10:00:00.000Z', invalid: 42 },
      ignoredOwnerField: 'must be stripped',
    }), allowedModuleIds);

    expect(parsed.moduleProgress).toEqual({
      'module-a': { status: 'done', startedAt: null, completedAt: '2026-09-04T08:00:00.000Z', updatedAt: '2026-09-04T08:00:00.000Z' },
    });
    expect(parsed.logs).toEqual([validLog]);
    expect(parsed.reports).toEqual([]);
    expect(parsed.projects[0]).toMatchObject({ githubUrl: null, coverImageUrl: null });
    expect(parsed.settings).toEqual({ weeklyGoalMinutes: 10080, focusMinutes: 1, shortBreakMinutes: 60, longBreakMinutes: 15, longBreakEvery: 12 });
    expect(parsed.earnedAchievements).toEqual({ first_module: '2026-09-04T10:00:00.000Z' });
    expect(parsed.completedQuests).toEqual({ modules_3: '2026-09-04T10:00:00.000Z' });
    expect(parsed).not.toHaveProperty('ignoredOwnerField');
  });

  it('bounds persisted collection scans before accepting valid late records', () => {
    const invalidLog = { ...validLog, id: '', minutes: 0 };
    const invalidProject = { ...validProject, id: '', status: 'published' };
    const logs = [invalidLog, validLog, ...Array.from({ length: 998 }, () => invalidLog), { ...validLog, id: 'late-log' }];
    const projects = [invalidProject, validProject, ...Array.from({ length: 998 }, () => invalidProject), { ...validProject, id: 'late-project' }];

    const parsed = parseDemoState(JSON.stringify({ ...createDemoState(), logs, projects }), allowedModuleIds);

    expect(parsed.logs).toEqual([validLog]);
    expect(parsed.projects).toEqual([validProject]);
  });
});

describe('v2 demo reducer', () => {
  it('records deterministic module timestamps and preserves immutable state', () => {
    const initial = createDemoState();
    const learning = demoReducer(initial, { type: 'module/status', moduleId: 'module-a', status: 'learning', now: '2026-09-04T10:00:00.000Z' });
    const done = demoReducer(learning, { type: 'module/status', moduleId: 'module-a', status: 'done', now: '2026-09-04T11:00:00.000Z' });

    expect(initial.moduleProgress).toEqual({});
    expect(done.moduleProgress['module-a']).toEqual({
      status: 'done', startedAt: '2026-09-04T10:00:00.000Z', completedAt: '2026-09-04T11:00:00.000Z', updatedAt: '2026-09-04T11:00:00.000Z',
    });
  });

  it('adds validated reports and clamps settings through reducer actions', () => {
    const withReport = demoReducer(createDemoState(), {
      type: 'report/add',
      report: {
        id: 'report-1', moduleId: 'module-a', activityTitle: 'Calibration exercise', confidence: 4, difficulty: 3,
        timeSpentMinutes: 35, whatLearned: 'Calibration matters.', struggles: null, createdAt: '2026-09-04T12:00:00.000Z',
      },
    });
    const changed = demoReducer(withReport, {
      type: 'settings/update',
      settings: { weeklyGoalMinutes: 0, focusMinutes: 999, shortBreakMinutes: 5, longBreakMinutes: 15, longBreakEvery: 4 },
    });

    expect(changed.reports).toHaveLength(1);
    expect(changed.settings).toMatchObject({ weeklyGoalMinutes: 1, focusMinutes: 180 });
  });

  it('timestamps project lifecycle transitions without mutating the input project', () => {
    const input = { ...validProject, id: 'new-project', createdAt: null, updatedAt: null };
    const saved = demoReducer(createDemoState(), { type: 'project/save', project: input, now: '2026-09-04T13:00:00.000Z' });
    const completed = demoReducer(saved, { type: 'project/status', id: 'new-project', status: 'completed', now: '2026-09-04T14:00:00.000Z' });

    expect(input).toMatchObject({ createdAt: null, updatedAt: null });
    expect(completed.projects[0]).toMatchObject({
      createdAt: '2026-09-04T13:00:00.000Z', updatedAt: '2026-09-04T14:00:00.000Z',
      startedAt: null, completedAt: '2026-09-04T14:00:00.000Z',
    });
  });
});

describe('demo storage helpers', () => {
  it('loads v2 first and migrates v1 only when v2 is absent', () => {
    const v2 = { ...createDemoState(), logs: [validLog] };
    const storage = new MemoryStorage({
      [DEMO_STORAGE_KEY]: JSON.stringify(v2),
      [LEGACY_DEMO_STORAGE_KEY]: JSON.stringify({ schemaVersion: 1, moduleStatusOverrides: { 'module-a': 'done' }, logs: [], projects: [] }),
    });

    expect(loadDemoState(storage, allowedModuleIds)).toEqual(v2);
  });

  it('round-trips only validated v2 state and never persists derived totals', () => {
    const storage = new MemoryStorage({ theme: 'dark' });
    const changed = demoReducer(createDemoState(), { type: 'log/add', log: validLog });

    saveDemoState(storage, { ...changed, xp: 999 } as DemoStateV2 & { xp: number });

    expect(loadDemoState(storage, allowedModuleIds)).toEqual(changed);
    expect(storage.getItem('theme')).toBe('dark');
    expect(JSON.parse(storage.getItem(DEMO_STORAGE_KEY)!)).not.toHaveProperty('xp');
  });

  it('removes exactly all demo keys and preserves owner/session preferences', () => {
    const storage = new MemoryStorage({
      theme: 'dark',
      yl_focus_session_v1: 'owner-session-sentinel',
      [DEMO_STORAGE_KEY]: '{}',
      [LEGACY_DEMO_STORAGE_KEY]: '{}',
      [DEMO_FOCUS_STORAGE_KEY]: '{}',
    });

    resetDemoState(storage);

    expect(storage.getItem(DEMO_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(LEGACY_DEMO_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(DEMO_FOCUS_STORAGE_KEY)).toBeNull();
    expect(storage.getItem('yl_focus_session_v1')).toBe('owner-session-sentinel');
    expect(storage.getItem('theme')).toBe('dark');
  });
});

describe('calculateDemoStats compatibility summary', () => {
  it('derives completion, study, and project totals without persisting them', () => {
    const state: DemoStateV2 = {
      ...createDemoState(),
      moduleProgress: {
        'module-a': { status: 'done', startedAt: null, completedAt: null, updatedAt: null },
        'module-b': { status: 'exercise', startedAt: null, completedAt: null, updatedAt: null },
      },
      logs: [{ ...validLog, minutes: 1 }, { ...validLog, id: 'log-2', minutes: 301 }],
      projects: [{ ...validProject, status: 'completed' }],
    };

    expect(calculateDemoStats(state)).toEqual({ completedModules: 1, totalMinutes: 302, completedProjects: 1, xp: 201 });
  });
});
