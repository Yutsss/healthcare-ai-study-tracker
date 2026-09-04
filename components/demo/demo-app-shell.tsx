'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { DemoCelebrationProvider } from '@/components/celebration/celebration-provider';
import { LabShell } from '@/components/app-shell/lab-shell';
import { DEMO_ROUTES } from '@/lib/lab/routes';
import type { DemoStarterProject } from '@/lib/demo/state';
import { DemoFocusSessionProvider } from '@/lib/demo/focus-session';
import { DemoProvider, useDemo } from './demo-provider';

function DemoShellFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { progression, reset, storageWarning } = useDemo();
  return (
    <DemoCelebrationProvider level={progression.level}>
      <LabShell
        mode="demo"
        routes={DEMO_ROUTES}
        pathname={pathname}
        level={progression.level}
        identityLabel="Demo · Stored in this browser"
        storageWarning={storageWarning}
        onReset={reset}
      >
        {children}
      </LabShell>
    </DemoCelebrationProvider>
  );
}

export function DemoAppShell({
  moduleIds,
  starterProjects,
  children,
}: {
  moduleIds: readonly string[];
  starterProjects: readonly DemoStarterProject[];
  children: React.ReactNode;
}) {
  return (
    <DemoProvider moduleIds={moduleIds} starterProjects={starterProjects}>
      <DemoFocusSessionProvider>
        <DemoShellFrame>{children}</DemoShellFrame>
      </DemoFocusSessionProvider>
    </DemoProvider>
  );
}
