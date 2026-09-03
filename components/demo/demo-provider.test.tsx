import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { PublicShell } from '@/components/public/public-shell';
import { DEMO_STORAGE_KEY } from '@/lib/demo/state';
import { DemoApp, type DemoSeed } from './demo-app';

const seed: DemoSeed = {
  roadmap: [
    { id: 'roadmap-1', title: 'Healthcare AI Foundations', phaseLabel: 'Phase 1 — Foundations', order: 1, provider: 'Coursera', category: 'Healthcare AI' },
  ],
  courseUnits: [
    { id: 'unit-1', roadmapId: 'roadmap-1', title: 'Clinical data basics', order: 1 },
  ],
  modules: [
    { id: 'module-1', roadmapId: 'roadmap-1', courseUnitId: 'unit-1', title: 'Safe clinical datasets', order: 1 },
    { id: 'module-2', roadmapId: 'roadmap-1', courseUnitId: 'unit-1', title: 'Model evaluation', order: 2 },
  ],
  starterProjects: [
    { id: 'starter-1', title: 'Triage helper', type: 'Portfolio', skills: ['Python'], github_url: null },
  ],
};

function renderDemo() {
  return render(
    <PublicShell mode="demo">
      <DemoApp seed={seed} />
    </PublicShell>,
  );
}

function openTab(name: 'Roadmap' | 'Study Log' | 'Projects' | 'Progress') {
  const tab = screen.getByRole('tab', { name });
  fireEvent.mouseDown(tab, { button: 0, ctrlKey: false });
  fireEvent.click(tab);
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('interactive guest demo', () => {
  it('renders starter data, persistent demo labels, locked owner areas, and no owner showcase metrics', async () => {
    renderDemo();

    expect(screen.getByText('Interactive demo')).toBeInTheDocument();
    expect(screen.getByText('Your private demo')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Dashboard' })).toHaveAttribute('data-state', 'active');
    expect(screen.getByText('Curriculum administration — Locked')).toBeInTheDocument();
    expect(screen.getByText('Settings — Locked')).toBeInTheDocument();
    expect(screen.getByText('Triage helper')).toBeInTheDocument();
    expect(screen.queryByText('450 XP')).not.toBeInTheDocument();
    expect(screen.queryByText('42 / 100 modules')).not.toBeInTheDocument();
    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument();

    await waitFor(() => expect(window.localStorage.getItem(DEMO_STORAGE_KEY)).not.toBeNull());
  });

  it('updates a module locally, supports curriculum search, and hydrates the saved status on reload', async () => {
    const first = renderDemo();
    openTab('Roadmap');

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search curriculum' }), { target: { value: 'model evaluation' } });
    expect(screen.queryByText('Safe clinical datasets')).not.toBeInTheDocument();
    expect(screen.getByText('Model evaluation')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: 'Status for Model evaluation' }), { target: { value: 'done' } });
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem(DEMO_STORAGE_KEY)!).moduleStatusOverrides).toEqual({ 'module-2': 'done' }));

    first.unmount();
    renderDemo();
    openTab('Roadmap');
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Status for Model evaluation' })).toHaveValue('done'));
  });

  it('adds and deletes a bounded study log', async () => {
    renderDemo();
    openTab('Study Log');

    fireEvent.change(screen.getByLabelText('Minutes'), { target: { value: '1441' } });
    fireEvent.change(screen.getByLabelText('Topic'), { target: { value: 'Clinical safety' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add study log' }));
    expect(screen.getByRole('alert')).toHaveTextContent('between 1 and 1440');
    expect(screen.queryByText('Clinical safety', { selector: 'h3' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Minutes'), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add study log' }));
    expect(await screen.findByText('Clinical safety', { selector: 'h3' })).toBeInTheDocument();
    expect(screen.getByText('25 minutes')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete log Clinical safety' }));
    expect(screen.queryByText('Clinical safety', { selector: 'h3' })).not.toBeInTheDocument();
  });

  it('creates, edits, changes status, archives, and deletes projects through local state', async () => {
    renderDemo();
    openTab('Projects');

    fireEvent.change(screen.getByLabelText('Project title'), { target: { value: 'Readmission risk explorer' } });
    fireEvent.change(screen.getByLabelText('Project description'), { target: { value: 'Explore safe evaluation approaches.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));
    expect(await screen.findByRole('heading', { name: 'Readmission risk explorer' })).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: 'Status for Readmission risk explorer' }), { target: { value: 'in_progress' } });
    expect(screen.getByRole('combobox', { name: 'Status for Readmission risk explorer' })).toHaveValue('in_progress');

    fireEvent.click(screen.getByRole('button', { name: 'Edit Readmission risk explorer' }));
    fireEvent.change(screen.getByLabelText('Project title'), { target: { value: 'Readmission safety explorer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save project' }));
    expect(screen.getByRole('heading', { name: 'Readmission safety explorer' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Archive Readmission safety explorer' }));
    expect(screen.getByRole('combobox', { name: 'Status for Readmission safety explorer' })).toHaveValue('archived');

    fireEvent.click(screen.getByRole('button', { name: 'Delete Readmission safety explorer' }));
    expect(screen.queryByRole('heading', { name: 'Readmission safety explorer' })).not.toBeInTheDocument();
  });

  it('confirms reset, removes only demo storage, and returns to starter state', async () => {
    window.localStorage.setItem('theme', 'dark');
    renderDemo();
    openTab('Roadmap');
    fireEvent.change(screen.getByRole('combobox', { name: 'Status for Safe clinical datasets' }), { target: { value: 'done' } });
    await waitFor(() => expect(window.localStorage.getItem(DEMO_STORAGE_KEY)).not.toBeNull());

    fireEvent.click(screen.getByRole('button', { name: 'Reset demo' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reset local demo' }));

    await waitFor(() => expect(window.localStorage.getItem(DEMO_STORAGE_KEY)).toBeNull());
    expect(window.localStorage.getItem('theme')).toBe('dark');
    expect(screen.getByRole('combobox', { name: 'Status for Safe clinical datasets' })).toHaveValue('not_started');
    openTab('Projects');
    expect(screen.getByRole('heading', { name: 'Triage helper' })).toBeInTheDocument();
  });
});
