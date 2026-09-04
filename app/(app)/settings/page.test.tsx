import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsPage from './page';

// Vitest preserves JSX for this Next.js client module, so React must be available
// to the classic test transform used by the repository.
(globalThis as typeof globalThis & { React: typeof React }).React = React;

const { createClient, mutateAsync, refetchShowcase, toast } = vi.hoisted(() => ({
  createClient: vi.fn(),
  mutateAsync: vi.fn(),
  refetchShowcase: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

let showcaseState: Record<string, unknown>;

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('sonner', () => ({ toast }));
vi.mock('@/lib/supabase/browser', () => ({ createClient }));
vi.mock('@/lib/hooks/useShowcaseSettings', () => ({
  useShowcaseSettings: () => showcaseState,
  useUpdateShowcaseSettings: () => ({ mutateAsync, isPending: false }),
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <SettingsPage />
    </QueryClientProvider>,
  );
}

function expectPublicationInputsDisabled() {
  expect(screen.getByRole('switch', { name: 'Enable public showcase' })).toBeDisabled();
  expect(screen.getByLabelText('Public bio')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Save showcase settings' })).toBeDisabled();
}

describe('SettingsPage showcase publication controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'owner-1', email: 'owner@example.com' } } }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ownerId: 'owner-1', counts: {} }),
    }));
    mutateAsync.mockResolvedValue({ showcase_enabled: false, showcase_bio: 'Updated bio' });
  });

  it('keeps every publication input disabled while settings are loading', () => {
    showcaseState = {
      settings: null,
      isLoading: true,
      isError: false,
      isSuccess: false,
      refetch: refetchShowcase,
    };

    renderPage();

    expect(screen.getByRole('status')).toHaveTextContent('Loading showcase settings');
    expectPublicationInputsDisabled();
  });

  it('shows a generic query error and offers retry while keeping publication inputs disabled', () => {
    showcaseState = {
      settings: null,
      isLoading: false,
      isError: true,
      isSuccess: false,
      error: new Error('relation owner_settings does not exist'),
      refetch: refetchShowcase,
    };

    renderPage();

    expect(screen.getByRole('alert')).toHaveTextContent('Could not load showcase settings');
    expect(screen.queryByText(/owner_settings/i)).not.toBeInTheDocument();
    expectPublicationInputsDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Retry loading showcase settings' }));
    expect(refetchShowcase).toHaveBeenCalledTimes(1);
  });

  it('treats a missing settings row as unavailable rather than editable defaults', () => {
    showcaseState = {
      settings: null,
      isLoading: false,
      isError: false,
      isSuccess: true,
      refetch: refetchShowcase,
    };

    renderPage();

    expect(screen.getByRole('alert')).toHaveTextContent('Showcase settings are unavailable');
    expectPublicationInputsDisabled();
  });

  it('loads saved values and allows the owner to edit and save them', async () => {
    showcaseState = {
      settings: {
        display_name: 'Owner',
        showcase_enabled: true,
        showcase_bio: 'Existing public bio',
      },
      isLoading: false,
      isError: false,
      isSuccess: true,
      refetch: refetchShowcase,
    };

    renderPage();

    const enabled = screen.getByRole('switch', { name: 'Enable public showcase' });
    const bio = screen.getByLabelText('Public bio');
    const save = screen.getByRole('button', { name: 'Save showcase settings' });
    expect(enabled).toBeEnabled();
    expect(enabled).toHaveAttribute('aria-checked', 'true');
    expect(bio).toBeEnabled();
    expect(bio).toHaveValue('Existing public bio');
    expect(save).toBeEnabled();

    fireEvent.click(enabled);
    fireEvent.change(bio, { target: { value: '  Updated bio  ' } });
    fireEvent.click(save);

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({
      showcase_enabled: false,
      showcase_bio: '  Updated bio  ',
    }));
    expect(toast.success).toHaveBeenCalledWith('Showcase settings saved');
  });
});
