import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import courseSeed from '@/data/yutas-lab-course-seed.json';
import { buildDemoCurriculum } from '@/lib/demo/curriculum';
import { createDemoState } from '@/lib/demo/state';
import { DEMO_ROUTES, OWNER_ROUTES } from '@/lib/lab/routes';
import type { LabProgressionView } from '@/lib/lab/types';
import { DashboardScreen } from './dashboard-screen';

const tree = buildDemoCurriculum(courseSeed, createDemoState().moduleProgress);
const progression: LabProgressionView = {
  xpEvents: [],
  totalXp: 0,
  level: { level: 1, xp: 0, title: 'New Explorer', currentFloor: 0, nextAt: 100, progress: 0, remaining: 100 },
  streak: { current: 0, activeToday: false, longest: 0 },
  achievements: [{
    id: 'achievement-1', earnedAt: null,
    def: { key: 'first-module', title: 'First Step', description: 'Complete one module.', icon: 'award', xp_reward: 25, metric: 'modules_done', target: 1 },
    current: 0, target: 1, ratio: 0, complete: false,
  }],
  quests: [{
    id: '2026-08-31:quest-1', week_start: '2026-08-31', key: 'quest-1', title: 'Start Strong',
    description: 'Complete one module.', quest_type: 'modules', target: 1, progress: 0, xp_reward: 30,
    completed_at: null, current: 0, ratio: 0, complete: false, template: undefined,
  }],
  milestones: [{
    id: 'milestone-1', key: 'foundation', title: 'Foundations', description: 'Build solid foundations.',
    sort_order: 1, achieved_at: null, phases: [tree.phases[0]], phasesDone: 0, percent: 0, complete: false, index: 1,
  }],
  activity: [],
};

function renderDashboard(mode: 'owner' | 'demo') {
  const onSetModuleStatus = vi.fn().mockResolvedValue(undefined);
  const onCreateReport = vi.fn().mockResolvedValue(undefined);
  render(
    <DashboardScreen
      mode={mode}
      name={mode === 'owner' ? 'Yuta' : 'Guest'}
      routes={mode === 'owner' ? OWNER_ROUTES : DEMO_ROUTES}
      tree={tree}
      loading={false}
      error={false}
      progression={progression}
      progressionLoading={false}
      logs={[]}
      reports={[]}
      weeklyGoal={300}
      onSetModuleStatus={onSetModuleStatus}
      onCreateReport={onCreateReport}
    />,
  );
  return { onSetModuleStatus, onCreateReport };
}

describe('DashboardScreen', () => {
  it.each(['owner', 'demo'] as const)('shows the canonical dashboard content in %s mode', (mode) => {
    renderDashboard(mode);

    expect(screen.getByText('Your Healthcare AI journey, one module at a time.')).toBeInTheDocument();
    expect(screen.getByTestId('stat-modules')).toHaveTextContent('0/265');
    expect(screen.getByTestId('stat-courses')).toHaveTextContent('0/58');
    expect(screen.getByText('Weekly quests')).toBeInTheDocument();
    expect(screen.getByText('Journey milestones')).toBeInTheDocument();
    expect(screen.getByText('Nearest achievements')).toBeInTheDocument();
    expect(screen.getAllByText('IBM Data Science Professional Certificate').length).toBeGreaterThan(0);
  });

  it('routes every internal demo dashboard link through /demo', () => {
    renderDashboard('demo');

    for (const link of screen.getAllByRole('link')) {
      const href = link.getAttribute('href') || '';
      if (!href.startsWith('http')) expect(href).toMatch(/^\/demo(?:\/|$|#)/);
    }
  });

  it('sends only the selected canonical module id to status and report actions', async () => {
    const { onSetModuleStatus, onCreateReport } = renderDashboard('demo');
    const continueCard = screen.getByTestId('continue-card');
    fireEvent.click(within(continueCard).getByRole('radio', { name: 'Learning' }));
    await waitFor(() => expect(onSetModuleStatus).toHaveBeenCalledWith('module-001', 'learning'));
    await waitFor(() => expect(screen.getByTestId('continue-report')).not.toBeDisabled());

    fireEvent.click(screen.getByTestId('continue-report'));
    fireEvent.click(screen.getByTestId('confidence-4'));
    fireEvent.click(screen.getByTestId('difficulty-3'));
    fireEvent.change(screen.getByTestId('report-activity-title'), { target: { value: 'Pandas lab' } });
    fireEvent.click(screen.getByTestId('report-after-keep'));
    fireEvent.click(screen.getByTestId('report-submit'));

    await waitFor(() => expect(onCreateReport).toHaveBeenCalledWith(expect.objectContaining({
      moduleId: 'module-001', activityTitle: 'Pandas lab', confidence: 4, difficulty: 3,
    })));
  });
});
