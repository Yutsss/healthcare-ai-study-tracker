import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import courseSeed from '@/data/yutas-lab-course-seed.json';
import { buildDemoCurriculum } from '@/lib/demo/curriculum';
import { createDemoState } from '@/lib/demo/state';
import { DEMO_ROUTES, OWNER_ROUTES } from '@/lib/lab/routes';
import { RoadmapScreen } from './roadmap-screen';

const tree = buildDemoCurriculum(courseSeed, createDemoState().moduleProgress);

function renderRoadmap(mode: 'owner' | 'demo') {
  const onSetModuleStatus = vi.fn().mockResolvedValue(undefined);
  const onCreateReport = vi.fn().mockResolvedValue(undefined);
  render(
    <RoadmapScreen
      mode={mode}
      routes={mode === 'owner' ? OWNER_ROUTES : DEMO_ROUTES}
      tree={tree}
      loading={false}
      error={false}
      reports={[]}
      busy={false}
      onSetModuleStatus={onSetModuleStatus}
      onCreateReport={onCreateReport}
    />,
  );
  return { onSetModuleStatus, onCreateReport };
}

describe('RoadmapScreen', () => {
  it.each(['owner', 'demo'] as const)('renders the same canonical roadmap in %s mode', (mode) => {
    renderRoadmap(mode);

    expect(screen.getByRole('heading', { name: 'Roadmap' })).toBeInTheDocument();
    expect(screen.getByText('14 phases · 58 courses · 265 modules')).toBeInTheDocument();
    expect(screen.getByText('IBM Data Science Professional Certificate')).toBeInTheDocument();
    expect(screen.getByTestId('overall-percent')).toHaveTextContent('0%');
  });

  it('searches canonical modules and forwards their exact id to demo actions', async () => {
    const { onSetModuleStatus, onCreateReport } = renderRoadmap('demo');
    fireEvent.change(screen.getByTestId('roadmap-search'), { target: { value: 'Defining Data Science' } });

    expect(screen.getByText('Defining Data Science and What Data Scientists Do')).toBeInTheDocument();
    expect(screen.queryByText('Tools for Data Science')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: 'Learning' }));
    await waitFor(() => expect(onSetModuleStatus).toHaveBeenCalledWith('module-001', 'learning'));

    fireEvent.click(screen.getByTestId('report-module-001'));
    fireEvent.click(screen.getByTestId('confidence-5'));
    fireEvent.click(screen.getByTestId('difficulty-2'));
    fireEvent.click(screen.getByTestId('report-after-keep'));
    fireEvent.click(screen.getByTestId('report-submit'));
    await waitFor(() => expect(onCreateReport).toHaveBeenCalledWith(expect.objectContaining({ moduleId: 'module-001' })));
  });

  it('uses the injected demo route for its empty-state action', () => {
    render(
      <RoadmapScreen
        mode="demo" routes={DEMO_ROUTES} tree={null} loading={false} error={false} reports={[]} busy={false}
        onSetModuleStatus={vi.fn()} onCreateReport={vi.fn()}
      />,
    );
    expect(screen.getByRole('link', { name: 'Back to dashboard' })).toHaveAttribute('href', '/demo');
    expect(screen.queryByText(/Import curriculum/)).not.toBeInTheDocument();
  });
});
