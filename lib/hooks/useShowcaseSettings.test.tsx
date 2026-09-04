import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUpdateShowcaseSettings } from './useShowcaseSettings';

const { createClient, eq, select, single, update } = vi.hoisted(() => ({
  createClient: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  single: vi.fn(),
  update: vi.fn(),
}));

vi.mock('@/lib/supabase/browser', () => ({ createClient }));

function createWrapper() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useUpdateShowcaseSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    single.mockResolvedValue({
      data: null,
      error: { message: 'JSON object requested, multiple (or no) rows returned' },
    });
    select.mockReturnValue({ single });
    eq.mockReturnValue({ select });
    update.mockReturnValue({ eq });
    createClient.mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'owner-1' } } } }),
      },
      from: vi.fn().mockReturnValue({ update }),
    });
  });

  it('rejects a save when the update returns no settings row', async () => {
    const { result } = renderHook(() => useUpdateShowcaseSettings(), { wrapper: createWrapper() });

    await act(async () => {
      await expect(result.current.mutateAsync({
        showcase_enabled: true,
        showcase_bio: 'Public bio',
      })).rejects.toThrow('Could not save showcase settings');
    });

    expect(select).toHaveBeenCalledWith('display_name,showcase_enabled,showcase_bio');
    expect(single).toHaveBeenCalledTimes(1);
  });
});
