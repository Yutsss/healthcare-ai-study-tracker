import React from 'react';
import courseSeed from '@/data/yutas-lab-course-seed.json';
import { DemoAppShell } from '@/components/demo/demo-app-shell';

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <DemoAppShell
      moduleIds={courseSeed.modules.map((module) => module.id)}
      starterProjects={courseSeed.starter_projects}
    >
      {children}
    </DemoAppShell>
  );
}
