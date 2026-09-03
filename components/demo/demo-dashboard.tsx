'use client';

import React, { useMemo } from 'react';
import { BarChart3, BookCheck, Clock3, FolderCheck, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { calculateDemoStats } from '@/lib/demo/state';
import { useDemo } from './demo-provider';

type DemoDashboardProps = {
  progressView?: boolean;
};

export function DemoDashboard({ progressView = false }: DemoDashboardProps) {
  const { state } = useDemo();
  const stats = useMemo(() => calculateDemoStats(state), [state]);
  const metricCards = [
    { label: 'Modules completed', value: stats.completedModules, icon: BookCheck },
    { label: 'Minutes studied', value: stats.totalMinutes, icon: Clock3 },
    { label: 'Projects completed', value: stats.completedProjects, icon: FolderCheck },
    { label: 'Demo XP', value: stats.xp, icon: Sparkles },
  ];

  return (
    <section aria-labelledby={progressView ? 'demo-progress-title' : 'demo-dashboard-title'} className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h2 id={progressView ? 'demo-progress-title' : 'demo-dashboard-title'} className="text-2xl font-bold tracking-tight">
            {progressView ? 'Your demo progress' : 'Demo dashboard'}
          </h2>
          <Badge variant="secondary">Local-only data</Badge>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Statuses, study logs, and projects stay in this browser. Curriculum administration and account settings remain locked.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metricCards.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{label}</CardTitle>
              <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
            </CardHeader>
            <CardContent><p className="text-3xl font-bold tabular-nums">{value}</p></CardContent>
          </Card>
        ))}
      </div>

      {!progressView && state.projects.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" /> Project workspace</CardTitle>
            <CardDescription>Starter and guest-created projects are editable only in this demo.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {state.projects.slice(0, 4).map((project) => (
              <div key={project.id} className="rounded-lg border p-4">
                <h3 className="font-semibold">{project.title}</h3>
                <p className="mt-1 text-sm capitalize text-muted-foreground">{project.status.replaceAll('_', ' ')}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </section>
  );
}
