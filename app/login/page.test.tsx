import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPage from './page';

const { router, searchParams, signInWithPassword, resetPasswordForEmail, createClient } = vi.hoisted(() => ({
  router: { replace: vi.fn(), refresh: vi.fn() },
  searchParams: new URLSearchParams('next=/projects'),
  signInWithPassword: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => router,
  useSearchParams: () => searchParams,
}));

vi.mock('@/lib/supabase/browser', () => ({ createClient }));

vi.mock('@/lib/supabase/env', () => ({
  isSupabaseConfigured: () => true,
  missingPublicEnv: () => [],
}));

function ownerExistsResponse(exists = true) {
  return { json: async () => ({ configured: true, exists }) };
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signInWithPassword.mockResolvedValue({ error: null });
    resetPasswordForEmail.mockResolvedValue({ error: null });
    createClient.mockReturnValue({
      auth: { signInWithPassword, resetPasswordForEmail },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ownerExistsResponse()));
  });

  it('offers separate published-progress and browser-local guest entry points', () => {
    render(<LoginPage />);

    expect(screen.getByRole('link', { name: "View Yuta's progress" })).toHaveAttribute('href', '/showcase');
    expect(screen.getByRole('link', { name: 'Try guest demo' })).toHaveAttribute('href', '/demo');
    expect(screen.getByText(/owner tracker remains private/i)).toBeInTheDocument();
    expect(screen.getByText(/intentionally published read-only progress/i)).toBeInTheDocument();
    expect(screen.getByText(/isolated demo stored only in this browser/i)).toBeInTheDocument();
  });

  it('signs the owner in and safely returns to the requested private path', async () => {
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'safe-password' } });
    fireEvent.submit(screen.getByTestId('login-form'));

    await waitFor(() => expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'owner@example.com',
      password: 'safe-password',
    }));
    expect(router.replace).toHaveBeenCalledWith('/projects');
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it('preserves generic failed-sign-in feedback', async () => {
    signInWithPassword.mockResolvedValue({ error: new Error('account does not exist') });
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'safe-password' } });
    fireEvent.submit(screen.getByTestId('login-form'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');
    expect(screen.queryByText('account does not exist')).not.toBeInTheDocument();
  });

  it('preserves owner-account creation before sign-in', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(ownerExistsResponse(false))
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) }));
    render(<LoginPage />);

    await screen.findByText('Create the owner account');
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'safe-password' } });
    fireEvent.submit(screen.getByTestId('login-form'));

    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith('/api/auth/register-owner', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ email: 'owner@example.com', password: 'safe-password' }),
    })));
    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'owner@example.com', password: 'safe-password' });
  });

  it('preserves the non-enumerating password reset response', async () => {
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'OWNER@EXAMPLE.COM' } });
    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));

    await waitFor(() => expect(resetPasswordForEmail).toHaveBeenCalledWith('owner@example.com', {
      redirectTo: `${window.location.origin}/reset-password`,
    }));
    expect(screen.getByRole('status')).toHaveTextContent('If an account exists for that email, a password reset link has been sent.');
  });
});
