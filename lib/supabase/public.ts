import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './env';

/**
 * A cookie-free, publishable-key client for the read-only public RPC.
 * Keep this server-side: public pages never need an owner session.
 */
export function createPublicClient(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error('Public showcase client must be created on the server');
  }

  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
