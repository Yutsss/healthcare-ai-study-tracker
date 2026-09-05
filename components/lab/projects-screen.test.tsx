import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { LabProject } from '@/lib/lab/types';
import { ProjectsScreen } from './projects-screen';

const project: LabProject = {
  id: 'project-1', key: null, title: 'Clinical NLP assistant', description: 'A safe portfolio prototype.',
  project_type: 'Portfolio', status: 'idea', tags: ['Python'], github_url: null, demo_url: null,
  cover_image_url: null, is_public: true, started_at: null, completed_at: null, sort_order: 1,
  created_at: '2026-09-01T00:00:00.000Z', updated_at: '2026-09-01T00:00:00.000Z',
};

function renderProjects(canPublish: boolean) {
  const onCreate = vi.fn().mockResolvedValue(undefined);
  render(<ProjectsScreen mode={canPublish ? 'owner' : 'demo'} projects={[project]} loading={false} error={false} canPublish={canPublish} onCreate={onCreate} onUpdate={vi.fn()} onMove={vi.fn()} onDelete={vi.fn()} />);
  return onCreate;
}

describe('ProjectsScreen', () => {
  it('keeps the same board but removes every publication control in demo mode', () => {
    renderProjects(false);
    expect(screen.getByRole('heading', { name: 'Projects' })).toBeInTheDocument();
    expect(screen.getByText('Clinical NLP assistant')).toBeInTheDocument();
    expect(screen.getByTestId('column-idea')).toBeInTheDocument();
    expect(screen.queryByText('Public')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('project-edit-project-1'));
    expect(screen.queryByText('Show in public showcase')).not.toBeInTheDocument();
  });

  it('normalizes publication to false before creating a demo project', async () => {
    const onCreate = renderProjects(false);
    fireEvent.click(screen.getByTestId('project-new'));
    fireEvent.change(screen.getByTestId('project-title'), { target: { value: 'FHIR playground' } });
    fireEvent.click(screen.getByTestId('project-save'));
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ title: 'FHIR playground', is_public: false })));
  });

  it('retains explicit opt-in publication only for the owner', () => {
    renderProjects(true);
    fireEvent.click(screen.getByTestId('project-edit-project-1'));
    expect(screen.getByText('Show in public showcase')).toBeInTheDocument();
    expect(screen.getByTestId('project-public')).toBeChecked();
  });
});
