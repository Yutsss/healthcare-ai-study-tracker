import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import courseSeed from '@/data/yutas-lab-course-seed.json';
import { buildDemoCurriculum } from '@/lib/demo/curriculum';
import { deriveDemoProgression } from '@/lib/demo/progression';
import { createDemoState, demoReducer } from '@/lib/demo/state';
import { ProgressScreen } from './progress-screen';

const completed = demoReducer(createDemoState(), { type: 'module/status', moduleId: 'module-001', status: 'done', now: '2026-09-05T08:00:00.000Z' });
const state = demoReducer(completed, { type: 'report/add', report: { id: 'report-1', moduleId: 'module-001', activityTitle: 'Data science lab', confidence: 4, difficulty: 3, timeSpentMinutes: 30, whatLearned: 'Definitions', struggles: null, createdAt: '2026-09-05T09:00:00.000Z' } });
const tree = buildDemoCurriculum(courseSeed, state.moduleProgress);
const progression = deriveDemoProgression(state, tree, new Date('2026-09-05T10:00:00.000Z'));
const reports = state.reports.map((report) => ({ id: report.id, module_id: report.moduleId, activity_title: report.activityTitle, confidence: report.confidence, difficulty: report.difficulty, time_spent_minutes: report.timeSpentMinutes, what_learned: report.whatLearned, struggles: report.struggles, created_at: report.createdAt }));

describe('ProgressScreen', () => {
  it.each(['owner', 'demo'] as const)('renders the complete progression story in %s mode', (mode) => {
    render(<ProgressScreen mode={mode} tree={tree} reports={reports} xp={{ total: progression.totalXp, level: progression.level, events: progression.xpEvents }} achievements={progression.achievements} milestones={progression.milestones} quests={progression.quests} loading={false} />);

    expect(screen.getByRole('heading', { name: 'Progress' })).toBeInTheDocument();
    expect(screen.getByTestId('skill-tree')).toBeInTheDocument();
    expect(screen.getByTestId('weekly-quests')).toBeInTheDocument();
    expect(screen.getByTestId('xp-history')).toBeInTheDocument();
    expect(screen.getByTestId('confidence-trends')).toHaveTextContent('Avg confidence 4.0/5');
    expect(screen.getByTestId('achievements')).toHaveTextContent('First Steps');
    expect(screen.getByTestId('journey-milestones')).toHaveTextContent('General Data Science / AI Foundation');
  });
});
