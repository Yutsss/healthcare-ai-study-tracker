import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import courseSeed from '@/data/yutas-lab-course-seed.json';
import { buildDemoCurriculum } from '@/lib/demo/curriculum';
import { createDemoState } from '@/lib/demo/state';
import { DEFAULT_POMODORO } from '@/lib/focus';
import { DEMO_ROUTES } from '@/lib/lab/routes';
import { FocusScreen, type FocusController } from './focus-screen';

const tree = buildDemoCurriculum(courseSeed, createDemoState().moduleProgress);
const controller: FocusController = {
  session: null, live: null, start: vi.fn(), pause: vi.fn(), resume: vi.fn(), skipBreak: vi.fn(), stop: vi.fn().mockResolvedValue({ minutes: 0, logged: false }), stopping: false,
};

describe('FocusScreen', () => {
  it('uses the canonical current module and injected demo routes', () => {
    render(<FocusScreen mode="demo" routes={DEMO_ROUTES} controller={controller} settings={DEFAULT_POMODORO} settingsLoading={false} tree={tree} logs={[]} onSaveSettings={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Focus Mode' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Defining Data Science and What Data Scientists Do')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('focus-start'));
    expect(controller.start).toHaveBeenCalledWith(DEFAULT_POMODORO, 'Defining Data Science and What Data Scientists Do', 'module-001');
    expect(screen.getByRole('link', { name: 'View study log' })).toHaveAttribute('href', '/demo/log');
  });
});
