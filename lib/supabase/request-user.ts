import type { User } from '@supabase/supabase-js';
import { createClient } from './server';
import { createAdminClient } from './admin';

/**
 * Resolves the authenticated user for a Route Handler.
 * 1) `Authorization: Bearer <access_token>` (API clients / tests)
 * 2) Supabase session cookies (browser)
 */
export async function getRequestUser(request: Request): Promise<User | null> {
  const authHeader = request.headers.get('authorization') || '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();
    if (!token) return null;
    try {
      const admin = createAdminClient();
      const { data, error } = await admin.auth.getUser(token);
      if (error || !data?.user) return null;
      return data.user;
    } catch {
      return null;
    }
  }

  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return data?.user ?? null;
  } catch {
    return null;
  }
}
