import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import courseSeed from '@/data/yutas-lab-course-seed.json';
import DemoPage from '@/app/demo/page';
import DemoProjectsPage from '@/app/demo/projects/page';
import { DEMO_FOCUS_STORAGE_KEY, DEMO_STORAGE_KEY } from '@/lib/demo/state';
import { DemoAppShell } from './demo-app-shell';

vi.mock('next/navigation', () => ({
  usePathname: () => '/demo',
}));

const moduleIds = courseSeed.modules.map((module) => module.id);
const starterProjects = courseSeed.starter_projects;

function renderDemo(child: React.ReactNode) {
  return render(
    <DemoAppShell moduleIds={moduleIds} starterProjects={starterProjects}>
      {child}
    </DemoAppShell>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('guest demo isolation boundary', () => {
  it('uses the shared dashboard while persisting progress only in the demo namespace', async () => {
    const ownerFocusState = JSON.stringify({ private: 'owner session' });
    window.localStorage.setItem('yl_focus_session_v1', ownerFocusState);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('The guest demo must not use the network'));

    renderDemo(<DemoPage />);

    expect(await screen.findByText('Your Healthcare AI journey, one module at a time.')).toBeInTheDocument();
    expect(screen.getByTestId('demo-identity')).toHaveTextContent('Demo · Stored in this browser');
    expect(screen.queryByRole('link', { name: 'Curriculum' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument();

    const continueCard = screen.getByTestId('continue-card');
    fireEvent.click(within(continueCard).getByRole('radio', { name: 'Learning' }));

    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem(DEMO_STORAGE_KEY) || '{}');
      expect(saved.moduleProgress['module-001'].status).toBe('learning');
    });
    expect(window.localStorage.getItem('yl_focus_session_v1')).toBe(ownerFocusState);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('hides publication controls and reset removes only demo-owned keys', async () => {
    window.localStorage.setItem('theme', 'dark');
    window.localStorage.setItem('yl_focus_session_v1', 'owner-focus');
    window.localStorage.setItem(DEMO_FOCUS_STORAGE_KEY, '{"demo":"focus"}');

    renderDemo(<DemoProjectsPage />);

    expect(await screen.findByRole('heading', { name: 'Projects' })).toBeInTheDocument();
    expect(screen.queryByText('Public showcase')).not.toBeInTheDocument();
    expect(screen.queryByText('Show in public showcase')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reset demo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset local demo' }));

    await waitFor(() => expect(window.localStorage.getItem(DEMO_STORAGE_KEY)).toBeNull());
    expect(window.localStorage.getItem(DEMO_FOCUS_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem('yl_focus_session_v1')).toBe('owner-focus');
    expect(window.localStorage.getItem('theme')).toBe('dark');
  });
});
