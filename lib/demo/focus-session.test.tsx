import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DemoProvider, useDemo } from '@/components/demo/demo-provider';
import { DEMO_FOCUS_STORAGE_KEY } from './storage-keys';
import { DemoFocusSessionProvider, useDemoFocusSession } from './focus-session';

function Probe() {
  const focus = useDemoFocusSession();
  const demo = useDemo();
  return <div>
    <output data-testid="session">{focus.session?.phase || 'none'}</output>
    <output data-testid="logs">{demo.state.logs.length}</output>
    <button onClick={() => focus.start({ focusMinutes: 1, shortBreakMinutes: 1, longBreakMinutes: 1, longBreakEvery: 2 }, 'Safety study', 'module-001')}>Start</button>
    <button onClick={() => void focus.stop()}>Stop</button>
  </div>;
}

function renderProbe() {
  return render(<DemoProvider moduleIds={['module-001']} starterProjects={[]}><DemoFocusSessionProvider><Probe /></DemoFocusSessionProvider></DemoProvider>);
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('yl_focus_session_v1', 'owner-session-sentinel');
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-05T08:00:00.000Z'));
});

afterEach(() => vi.useRealTimers());

describe('DemoFocusSessionProvider', () => {
  it('restores only its own timer and writes one local log without touching owner persistence', async () => {
    const first = renderProbe();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(localStorage.getItem(DEMO_FOCUS_STORAGE_KEY)).toContain('Safety study');
    expect(localStorage.getItem('yl_focus_session_v1')).toBe('owner-session-sentinel');

    first.unmount();
    renderProbe();
    expect(screen.getByTestId('session')).toHaveTextContent('focus');

    act(() => vi.advanceTimersByTime(61_000));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Stop' })); });
    expect(screen.getByTestId('logs')).toHaveTextContent('1');
    expect(localStorage.getItem(DEMO_FOCUS_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem('yl_focus_session_v1')).toBe('owner-session-sentinel');
  });
});
