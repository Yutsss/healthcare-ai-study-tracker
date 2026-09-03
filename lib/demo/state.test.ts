import { describe, expect, it } from 'vitest';
import {
  DEMO_STORAGE_KEY,
  calculateDemoStats,
  createDemoState,
  demoReducer,
  loadDemoState,
  parseDemoState,
  resetDemoState,
  saveDemoState,
  type DemoLog,
  type DemoProject,
  type DemoState,
  type DemoStorage,
} from './state';

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
  id: 'log-1', loggedOn: '2026-09-03', minutes: 25, topic: 'Clinical AI', notes: 'Reviewed model evaluation.', moduleId: 'module-a', createdAt: '2026-09-03T10:00:00.000Z',
};
const validProject: DemoProject = {
  id: 'project-1', title: 'Triage helper', description: 'A safe portfolio project.', projectType: 'Portfolio', status: 'planned', tags: ['Python'], githubUrl: 'https://github.com/example/triage', demoUrl: 'https://example.com/triage', coverImageUrl: null,
};

describe('parseDemoState', () => {
  it.each([null, '{not json', JSON.stringify({ schemaVersion: 99 })])('returns a clean state for corrupt or obsolete saved data', (serialized) => {
    expect(parseDemoState(serialized, allowedModuleIds)).toEqual(createDemoState());
  });

  it('keeps only allowed module IDs and module statuses', () => {
    const parsed = parseDemoState(JSON.stringify({
      schemaVersion: 1,
      moduleStatusOverrides: { 'module-a': 'done', 'module-b': 'finished', unknown: 'learning' },
      logs: [],
      projects: [],
    }), allowedModuleIds);

    expect(parsed.moduleStatusOverrides).toEqual({ 'module-a': 'done' });
  });

  it.each(['not_started', 'learning', 'exercise', 'done'] as const)('retains the supported module status %s', (status) => {
    const parsed = parseDemoState(JSON.stringify({
      schemaVersion: 1,
      moduleStatusOverrides: { 'module-a': status },
      logs: [],
      projects: [],
    }), allowedModuleIds);

    expect(parsed.moduleStatusOverrides).toEqual({ 'module-a': status });
  });

  it('sanitizes persisted collections and text bounds', () => {
    const logs = Array.from({ length: 202 }, (_, index) => ({ ...validLog, id: `log-${index}`, minutes: index === 0 ? 0 : index === 1 ? 1441 : index === 2 ? 1 : index === 3 ? 1440 : 10, notes: 'n'.repeat(4001) }));
    const projects = Array.from({ length: 101 }, (_, index) => ({
      ...validProject,
      id: `project-${index}`,
      title: index === 0 ? 'x'.repeat(201) : `Project ${index}`,
      description: 'd'.repeat(4001),
      tags: Array.from({ length: 21 }, (_, tagIndex) => ` tag-${tagIndex}-${'x'.repeat(40)} `),
      githubUrl: 'javascript:alert(1)',
      demoUrl: 'https://example.com/demo',
      coverImageUrl: 'data:text/html,unsafe',
    }));

    const parsed = parseDemoState(JSON.stringify({ schemaVersion: 1, moduleStatusOverrides: {}, logs, projects }), allowedModuleIds);

    expect(parsed.logs).toHaveLength(200);
    expect(parsed.logs[0]).toMatchObject({ id: 'log-2', minutes: 1, notes: 'n'.repeat(4000) });
    expect(parsed.logs[1].minutes).toBe(1440);
    expect(parsed.projects).toHaveLength(100);
    expect(parsed.projects[0]).toMatchObject({
      id: 'project-0', title: 'x'.repeat(200), description: 'd'.repeat(4000),
      githubUrl: null, demoUrl: 'https://example.com/demo', coverImageUrl: null,
    });
    expect(parsed.projects[0].tags).toHaveLength(20);
    expect(parsed.projects[0].tags[0]).toBe(`tag-0-${'x'.repeat(34)}`);
    expect(parsed.projects[0].tags[19]).toBe(`tag-19-${'x'.repeat(33)}`);
  });

  it('drops projects with an unrecognized status', () => {
    const parsed = parseDemoState(JSON.stringify({
      schemaVersion: 1,
      moduleStatusOverrides: {},
      logs: [],
      projects: [validProject, { ...validProject, id: 'project-invalid', status: 'published' }],
    }), allowedModuleIds);

    expect(parsed.projects).toEqual([validProject]);
  });
});

describe('demoReducer', () => {
  it('does not mutate its state for module, log, or project actions', () => {
    const initial = createDemoState([validProject]);
    const before = JSON.parse(JSON.stringify(initial));
    const moduleAction = { type: 'module/status' as const, moduleId: 'module-a', status: 'done' as const };
    const logAction = { type: 'log/add' as const, log: { ...validLog } };
    const projectAction = { type: 'project/save' as const, project: { ...validProject, title: 'Updated title', tags: [...validProject.tags] } };
    const actionsBefore = JSON.parse(JSON.stringify([moduleAction, logAction, projectAction]));

    const afterModule = demoReducer(initial, moduleAction);
    const afterLog = demoReducer(afterModule, logAction);
    const afterProject = demoReducer(afterLog, projectAction);

    expect(initial).toEqual(before);
    expect([moduleAction, logAction, projectAction]).toEqual(actionsBefore);
    expect(afterModule).not.toBe(initial);
    expect(afterLog).not.toBe(afterModule);
    expect(afterProject).not.toBe(afterLog);
    expect(afterProject.projects[0].title).toBe('Updated title');
  });

  it('applies reset and delete actions without leaving derived values in state', () => {
    const changed = demoReducer(createDemoState(), { type: 'log/add', log: validLog });
    const reset = demoReducer(changed, { type: 'reset', initial: createDemoState([validProject]) });

    expect(demoReducer(reset, { type: 'project/delete', id: 'project-1' })).toEqual(createDemoState());
  });
});

describe('calculateDemoStats', () => {
  it('derives completion totals and exact XP from current state', () => {
    const state: DemoState = {
      ...createDemoState(),
      moduleStatusOverrides: { 'module-a': 'done', 'module-b': 'exercise' },
      logs: [
        { ...validLog, minutes: 1 },
        { ...validLog, id: 'log-2', minutes: 301 },
      ],
      projects: [{ ...validProject, status: 'completed' }],
    };

    expect(calculateDemoStats(state)).toEqual({ completedModules: 1, totalMinutes: 302, completedProjects: 1, xp: 201 });
  });
});

describe('demo storage helpers', () => {
  it('round-trips only the isolated state through the demo storage key', () => {
    const storage = new MemoryStorage({ theme: 'dark' });
    const changed = demoReducer(createDemoState(), { type: 'log/add', log: validLog });

    const stateWithUnpersistedMetric = { ...changed, xp: 999 };
    saveDemoState(storage, stateWithUnpersistedMetric);

    expect(loadDemoState(storage, allowedModuleIds)).toEqual(changed);
    expect(storage.getItem('theme')).toBe('dark');
    expect(JSON.parse(storage.getItem(DEMO_STORAGE_KEY)!)).toEqual(changed);
  });

  it('removes only the demo storage key during reset', () => {
    const changedState = demoReducer(createDemoState(), { type: 'log/add', log: validLog });
    const storage = new MemoryStorage({ theme: 'dark', 'yl-guest-demo:v1': JSON.stringify(changedState) });

    resetDemoState(storage);

    expect(storage.getItem('yl-guest-demo:v1')).toBeNull();
    expect(storage.getItem('theme')).toBe('dark');
  });
});
