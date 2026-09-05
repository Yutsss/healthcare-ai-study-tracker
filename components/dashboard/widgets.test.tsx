import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MilestoneBadges } from './widgets';

describe('MilestoneBadges', () => {
  it('uses a dark surface behind the light completed-milestone text', () => {
    const items = [{
        id: 'milestone-1',
        key: 'foundation',
        index: 1,
        title: 'General Data Science / AI Foundation',
        description: 'Python, Pandas, NumPy and SQL',
        complete: true,
        percent: 100,
        phasesDone: 5,
        phases: [],
        sort_order: 1,
        achieved_at: '2026-09-01T00:00:00.000Z',
      }];

    render(<MilestoneBadges items={items} />);

    const card = screen.getByTestId('milestone-foundation');
    expect(card).toHaveClass('dark:border-emerald-500/30');
    expect(card).toHaveClass('dark:from-emerald-500/15');
    expect(card).toHaveClass('dark:to-card');
  });
});
