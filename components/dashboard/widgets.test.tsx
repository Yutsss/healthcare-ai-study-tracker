import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MilestoneBadges } from './widgets';

const { useMilestones } = vi.hoisted(() => ({ useMilestones: vi.fn() }));

vi.mock('@/lib/hooks/useMilestones', () => ({ useMilestones }));

describe('MilestoneBadges', () => {
  it('uses a dark surface behind the light completed-milestone text', () => {
    useMilestones.mockReturnValue({
      isLoading: false,
      items: [{
        id: 'milestone-1',
        key: 'foundation',
        index: 1,
        title: 'General Data Science / AI Foundation',
        description: 'Python, Pandas, NumPy and SQL',
        complete: true,
        percent: 100,
        phasesDone: 5,
        phases: [{ id: 'phase-1' }],
      }],
    });

    render(<MilestoneBadges tree={null} />);

    const card = screen.getByTestId('milestone-foundation');
    expect(card).toHaveClass('dark:border-emerald-500/30');
    expect(card).toHaveClass('dark:from-emerald-500/15');
    expect(card).toHaveClass('dark:to-card');
  });
});
