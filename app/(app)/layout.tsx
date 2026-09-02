import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured, missingPublicEnv } from '@/lib/supabase/env';
import { SetupRequired } from '@/components/setup-required';
import { AppShell } from '@/components/app-shell/app-shell';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) return <SetupRequired missing={missingPublicEnv()} />;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return <AppShell email={user.email || ''}>{children}</AppShell>;
}
