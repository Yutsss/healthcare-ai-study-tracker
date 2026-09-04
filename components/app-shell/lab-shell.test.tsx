import React, { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DEMO_ROUTES, OWNER_ROUTES } from '@/lib/lab/routes';
import { LabShell } from './lab-shell';

const level = { level: 2, xp: 220, title: 'Curious Intern', currentFloor: 100, nextAt: 400, progress: 0.4, remaining: 180 };

function DemoHarness() {
  const [resets, setResets] = useState(0);
  return (
    <LabShell
      mode="demo"
      routes={DEMO_ROUTES}
      pathname="/demo/projects"
      level={level}
      identityLabel="Demo · Stored in this browser"
      onReset={() => setResets((value) => value + 1)}
    >
      <p>Demo page body</p>
      <output aria-label="reset count" data-testid="reset-count">{resets}</output>
    </LabShell>
  );
}

describe('LabShell', () => {
  it('renders the same six primary capabilities with demo routes and no owner-only authority', () => {
    render(<DemoHarness />);

    const navigation = screen.getByRole('navigation', { name: 'Primary navigation' });
    const links = within(navigation).getAllByRole('link');
    expect(links.map((link) => [link.textContent?.trim(), link.getAttribute('href')])).toEqual([
      ['Dashboard', '/demo'], ['Roadmap', '/demo/roadmap'], ['Focus', '/demo/focus'],
      ['Study Log', '/demo/log'], ['Projects', '/demo/projects'], ['Progress', '/demo/progress'],
    ]);
    expect(within(navigation).getByRole('link', { name: /Projects/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Demo · Stored in this browser')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Curriculum/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Settings/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
  });

  it('confirms reset before invoking the demo-local action', () => {
    render(<DemoHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Reset demo' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Reset your local demo?');
    expect(screen.getByTestId('reset-count')).toHaveTextContent('0');
    fireEvent.click(screen.getByRole('button', { name: 'Reset local demo' }));
    expect(screen.getByTestId('reset-count')).toHaveTextContent('1');
  });

  it('adds Curriculum, Settings, identity, and sign-out only for the owner shell', () => {
    function OwnerHarness() {
      const [signedOut, setSignedOut] = useState(false);
      return (
        <LabShell
          mode="owner"
          routes={OWNER_ROUTES}
          pathname="/roadmap"
          level={level}
          identityLabel="owner@example.com"
          onSignOut={async () => setSignedOut(true)}
        >
          <output aria-label="signed out">{String(signedOut)}</output>
        </LabShell>
      );
    }

    render(<OwnerHarness />);

    expect(screen.getByRole('link', { name: /Curriculum/ })).toHaveAttribute('href', '/curriculum');
    expect(screen.getByRole('link', { name: /Settings/ })).toHaveAttribute('href', '/settings');
    expect(screen.getByTestId('user-identity')).toHaveTextContent('owner@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(screen.getByRole('status', { name: 'signed out' })).toHaveTextContent('true');
  });
});
