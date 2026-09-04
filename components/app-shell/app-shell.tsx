'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/browser';
import { useXp } from '@/lib/hooks/useGamification';
import { OWNER_ROUTES } from '@/lib/lab/routes';
import { FocusLauncher } from '@/components/focus/focus-launcher';
import { FocusSessionProvider } from '@/lib/hooks/useFocusSession';
import { CelebrationProvider } from '@/components/celebration/celebration-provider';
import { LabShell } from './lab-shell';

export function AppShell({ email, children }: { email: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const xp = useXp();

  async function signOut() {
    await createClient().auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  return (
    <FocusSessionProvider>
      <CelebrationProvider>
        <LabShell
          mode="owner"
          routes={OWNER_ROUTES}
          pathname={pathname}
          level={xp.level}
          levelLoading={xp.isLoading}
          identityLabel={email}
          onSignOut={signOut}
          overlay={<FocusLauncher />}
        >
          {children}
        </LabShell>
      </CelebrationProvider>
    </FocusSessionProvider>
  );
}
