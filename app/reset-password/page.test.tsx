import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ResetPasswordPage from './page';

const { router, exchangeCodeForSession, getSession, onAuthStateChange, updateUser, createClient } = vi.hoisted(() => ({
  router: { replace: vi.fn(), refresh: vi.fn() },
  exchangeCodeForSession: vi.fn(),
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  updateUser: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/lib/supabase/env', () => ({
  isSupabaseConfigured: () => true,
  missingPublicEnv: () => [],
}));
vi.mock('@/lib/supabase/browser', () => ({ createClient }));

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/reset-password');
    exchangeCodeForSession.mockResolvedValue({ data: { session: { user: { id: 'owner-id' } } }, error: null });
    getSession.mockResolvedValue({ data: { session: null } });
    onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
    updateUser.mockResolvedValue({ error: null });
    createClient.mockReturnValue({
      auth: { exchangeCodeForSession, getSession, onAuthStateChange, updateUser },
    });
  });

  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('exchanges a recovery code, exposes the password form, and removes the one-time code from the URL', async () => {
    window.history.replaceState({}, '', '/reset-password?code=recovery-code');

    render(<React.StrictMode><ResetPasswordPage /></React.StrictMode>);

    await waitFor(() => expect(exchangeCodeForSession).toHaveBeenCalledWith('recovery-code'));
    expect(exchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(await screen.findByLabelText('New password')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/reset-password');
    expect(window.location.search).toBe('');
  });
});
