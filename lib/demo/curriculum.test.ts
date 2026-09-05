import { describe, expect, it } from 'vitest';
import courseSeed from '@/data/yutas-lab-course-seed.json';
import { createDemoState, demoReducer } from './state';
import { buildDemoCurriculum } from './curriculum';

describe('buildDemoCurriculum', () => {
  it('maps the reviewed seed into the complete owner-compatible zero-progress tree', () => {
    const tree = buildDemoCurriculum(courseSeed, createDemoState().moduleProgress);

    expect(tree.totals).toEqual({
      phases: 14,
      phasesDone: 0,
      phasesInProgress: 0,
      units: 58,
      unitsDone: 0,
      modules: 265,
      modulesDone: 0,
      modulesInProgress: 0,
      weightedPercent: 0,
    });
    expect(tree.phases[0]).toMatchObject({
      id: 'roadmap-01', key: 'roadmap-01', title: 'IBM Data Science Professional Certificate',
      phase_label: 'Phase 1 — Data Science Fundamentals', provider: 'IBM', sort_order: 1,
    });
    expect(tree.phases[0].units[0]).toMatchObject({
      id: 'unit-001', key: 'unit-001', title: 'What is Data Science?',
      source_urls: ['https://www.coursera.org/learn/what-is-datascience'],
    });
    expect(tree.phases[0].units[0].modules[0]).toMatchObject({
      id: 'module-001', key: 'module-001', title: 'Defining Data Science and What Data Scientists Do',
      source_type: 'Official Syllabus', source_url: 'https://www.coursera.org/learn/what-is-datascience',
      xp_value: 20, status: 'not_started',
    });
  });

  it('overlays timestamps for known modules and ignores unknown progress records', () => {
    const initial = createDemoState();
    const known = demoReducer(initial, {
      type: 'module/status', moduleId: 'module-001', status: 'done', now: '2026-09-04T08:00:00.000Z',
    });
    const state = {
      ...known,
      moduleProgress: {
        ...known.moduleProgress,
        'private-owner-module': { status: 'done' as const, startedAt: null, completedAt: null, updatedAt: null },
      },
    };

    const tree = buildDemoCurriculum(courseSeed, state.moduleProgress);

    expect(tree.totals).toMatchObject({ modulesDone: 1, modulesInProgress: 0 });
    expect(tree.phases[0].units[0].modules[0].progress).toMatchObject({
      module_id: 'module-001', status: 'done', completed_at: '2026-09-04T08:00:00.000Z',
    });
    expect(tree.phases.flatMap((phase) => phase.units).flatMap((unit) => unit.modules).some((module) => module.id === 'private-owner-module')).toBe(false);
  });
});
