import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PublicShell } from '@/components/public/public-shell';
import { ShowcaseView } from './showcase-view';
import type { PublicShowcase } from '@/lib/showcase';

const showcase: PublicShowcase = {
  profile: {
    displayName: 'Ada Lovelace',
    bio: 'Building thoughtful tools for clinical AI learners.',
  },
  stats: {
    xp: 450,
    phases: { completed: 3, total: 8 },
    courses: { completed: 10, total: 24 },
    modules: { completed: 42, total: 100 },
  },
  phases: [
    { key: 'foundations', title: 'Data foundations', completed: 4, total: 6 },
  ],
  achievements: [
    {
      key: 'first-module',
      title: 'First module',
      description: 'Completed a first module.',
      icon: 'BookCheck',
      earnedAt: '2026-09-02T00:00:00.000Z',
    },
  ],
  projects: [
    {
      title: 'Clinical notes classifier',
      description: 'A lightweight classifier for practice notes.',
      projectType: 'Machine learning',
      status: 'completed',
      tags: ['NLP', 'Python'],
      githubUrl: 'https://github.com/example/clinical-notes',
      demoUrl: 'https://example.com/clinical-notes',
      coverImageUrl: 'https://images.example.com/clinical-notes.png',
      startedAt: '2026-08-01',
      completedAt: '2026-08-31',
    },
  ],
  generatedAt: '2026-09-02T00:00:00.000Z',
};

function renderShowcase() {
  return render(
    <PublicShell mode="showcase">
      <ShowcaseView showcase={showcase} />
    </PublicShell>,
  );
}

describe('ShowcaseView', () => {
  it('renders the read-only public learning progress, achievement, and project', () => {
    renderShowcase();

    expect(screen.getByText('Public showcase')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument();
    expect(screen.getByText('Level 3')).toBeInTheDocument();
    expect(screen.getByText('3 / 8 phases')).toBeInTheDocument();
    expect(screen.getByText('First module')).toBeInTheDocument();
    expect(screen.getByText('Clinical notes classifier')).toBeInTheDocument();
    expect(screen.getByText('NLP')).toBeInTheDocument();
  });

  it('does not expose private fields or owner controls', () => {
    renderShowcase();

    expect(screen.queryByText('owner@example.com')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit|delete|save|publish/i })).not.toBeInTheDocument();
  });

  it('opens public project links safely in a new tab', () => {
    renderShowcase();

    for (const name of ['GitHub', 'Live demo', 'View cover image']) {
      const link = screen.getByRole('link', { name });
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });
});
