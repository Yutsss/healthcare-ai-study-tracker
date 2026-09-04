import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_STORAGE_KEY, createDemoState, type DemoStarterProject } from '@/lib/demo/state';
import { DemoProvider, useDemo } from './demo-provider';

const starterProjects: DemoStarterProject[] = [
  { id: 'starter-1', title: 'Triage helper', type: 'Portfolio', skills: ['Python'], github_url: null },
];

function ProviderProbe() {
  const { state, hydrated, progression, addReport, updateSettings, setModuleStatus } = useDemo();
  return (
    <div>
      <output data-testid="hydrated">{String(hydrated)}</output>
      <output data-testid="provider-state">{JSON.stringify(state)}</output>
      <output data-testid="provider-xp">{progression.totalXp}</output>
      <button onClick={() => addReport({
        moduleId: 'module-001', activityTitle: 'Safety drill', confidence: 4, difficulty: 3,
        timeSpentMinutes: 20, whatLearned: 'Validated safely.', struggles: null,
      }, new Date('2026-09-04T15:00:00.000Z'))}>Add report through provider</button>
      <button onClick={() => updateSettings({
        weeklyGoalMinutes: 420, focusMinutes: 45, shortBreakMinutes: 10, longBreakMinutes: 20, longBreakEvery: 3,
      })}>Update demo settings</button>
      <button onClick={() => {
        ['module-001', 'module-002', 'module-003', 'module-004'].forEach((moduleId, index) => {
          setModuleStatus(moduleId, 'done', new Date(`2026-09-04T08:${String(index).padStart(2, '0')}:00.000Z`));
        });
      }}>Complete canonical first course</button>
    </div>
  );
}

function renderProviderProbe() {
  return render(
    <DemoProvider
      moduleIds={['module-001', 'module-002', 'module-003', 'module-004']}
      starterProjects={starterProjects}
    >
      <ProviderProbe />
    </DemoProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DemoProvider', () => {
  it('hydrates and exposes reports and settings through the local provider surface', async () => {
    renderProviderProbe();

    await waitFor(() => expect(screen.getByTestId('hydrated')).toHaveTextContent('true'));
    fireEvent.click(screen.getByRole('button', { name: 'Add report through provider' }));
    fireEvent.click(screen.getByRole('button', { name: 'Update demo settings' }));

    await waitFor(() => {
      const state = JSON.parse(screen.getByTestId('provider-state').textContent || '{}');
      expect(state.reports).toEqual([{
        id: expect.any(String), moduleId: 'module-001', activityTitle: 'Safety drill', confidence: 4, difficulty: 3,
        timeSpentMinutes: 20, whatLearned: 'Validated safely.', struggles: null, createdAt: '2026-09-04T15:00:00.000Z',
      }]);
      expect(state.settings).toEqual({
        weeklyGoalMinutes: 420, focusMinutes: 45, shortBreakMinutes: 10, longBreakMinutes: 20, longBreakEvery: 3,
      });
    });
  });

  it('persists earned achievements and completed weekly quests exactly once', async () => {
    renderProviderProbe();

    await waitFor(() => expect(screen.getByTestId('hydrated')).toHaveTextContent('true'));
    fireEvent.click(screen.getByRole('button', { name: 'Complete canonical first course' }));

    await waitFor(() => {
      const state = JSON.parse(screen.getByTestId('provider-state').textContent || '{}');
      expect(Object.keys(state.earnedAchievements).sort()).toEqual(['first_module', 'first_unit']);
      expect(Object.keys(state.completedQuests)).toEqual(['2026-08-31:modules_4']);
      expect(screen.getByTestId('provider-xp')).toHaveTextContent('220');
    });
  });

  it('keeps local interactions available and disables persistence if storage cannot be read', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage read denied', 'SecurityError');
    });

    renderProviderProbe();

    await waitFor(() => expect(screen.getByTestId('hydrated')).toHaveTextContent('true'));
    fireEvent.click(screen.getByRole('button', { name: 'Add report through provider' }));
    await waitFor(() => expect(JSON.parse(screen.getByTestId('provider-state').textContent || '{}').reports).toHaveLength(1));
    expect(setItem).not.toHaveBeenCalled();
  });

  it('reads the current demo envelope exactly once when it exists', async () => {
    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(createDemoState(starterProjects)));
    const getItem = vi.spyOn(Storage.prototype, 'getItem');

    renderProviderProbe();

    await waitFor(() => expect(screen.getByTestId('hydrated')).toHaveTextContent('true'));
    expect(getItem).toHaveBeenCalledTimes(1);
    expect(getItem).toHaveBeenCalledWith(DEMO_STORAGE_KEY);
  });
});
