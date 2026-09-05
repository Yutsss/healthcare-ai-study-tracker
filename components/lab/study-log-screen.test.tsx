import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import courseSeed from '@/data/yutas-lab-course-seed.json';
import { buildDemoCurriculum } from '@/lib/demo/curriculum';
import { createDemoState } from '@/lib/demo/state';
import { DEMO_ROUTES } from '@/lib/lab/routes';
import { StudyLogScreen } from './study-log-screen';

const tree = buildDemoCurriculum(courseSeed, createDemoState().moduleProgress);
const logs = [{ id: 'log-1', logged_on: '2026-09-05', minutes: 45, topic: 'Clinical data', notes: null, module_id: 'module-001', project_id: null, created_at: '2026-09-05T08:00:00.000Z', source: 'focus', focus_intervals: 2 }];

describe('StudyLogScreen', () => {
  it('shows owner-parity history while routing and mutating through injected demo callbacks', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const onSaveWeeklyGoal = vi.fn().mockResolvedValue(undefined);
    render(<StudyLogScreen mode="demo" routes={DEMO_ROUTES} tree={tree} logs={logs} reports={[]} loading={false} weeklyGoal={300} onDelete={onDelete} onSaveWeeklyGoal={onSaveWeeklyGoal} />);

    expect(screen.getByRole('heading', { name: 'Study Log' })).toBeInTheDocument();
    expect(screen.getByText('Clinical data')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Start focus session/ })).toHaveAttribute('href', '/demo/focus');
    fireEvent.change(screen.getByTestId('goal-input'), { target: { value: '420' } });
    fireEvent.click(screen.getByTestId('goal-save'));
    await waitFor(() => expect(onSaveWeeklyGoal).toHaveBeenCalledWith(420));
    fireEvent.click(screen.getByTestId('log-delete-log-1'));
    fireEvent.click(screen.getByTestId('log-delete-confirm-log-1'));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('log-1'));
  });
});
