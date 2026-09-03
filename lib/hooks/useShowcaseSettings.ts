'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/browser';

export type ShowcaseSettings = {
  display_name: string | null;
  showcase_enabled: boolean;
  showcase_bio: string | null;
};

export type ShowcaseSettingsInput = {
  showcase_enabled: boolean;
  showcase_bio: string;
};

export const SHOWCASE_SETTINGS_KEY = ['showcase-settings'];

async function getAuthenticatedUserId() {
  const { data } = await createClient().auth.getSession();
  const id = data?.session?.user?.id;
  if (!id) throw new Error('Not signed in');
  return id;
}

export function useShowcaseSettings() {
  const q = useQuery({
    queryKey: SHOWCASE_SETTINGS_KEY,
    queryFn: async () => {
      const supabase = createClient();
      const ownerId = await getAuthenticatedUserId();
      const { data, error } = await supabase
        .from('owner_settings')
        .select('display_name,showcase_enabled,showcase_bio')
        .eq('owner_id', ownerId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data || null) as ShowcaseSettings | null;
    },
  });

  return { ...q, settings: q.data || null };
}

export function useUpdateShowcaseSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ShowcaseSettingsInput) => {
      const supabase = createClient();
      const ownerId = await getAuthenticatedUserId();
      const publication = {
        showcase_enabled: input.showcase_enabled === true,
        showcase_bio: input.showcase_bio.trim().slice(0, 500) || null,
      };
      const { error } = await supabase.from('owner_settings').update(publication).eq('owner_id', ownerId);
      if (error) throw new Error(error.message);
      return publication;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: SHOWCASE_SETTINGS_KEY }),
  });
}
