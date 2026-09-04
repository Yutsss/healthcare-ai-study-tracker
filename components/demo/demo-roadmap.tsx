'use client';

import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { ModuleStatus } from '@/lib/demo/state';
import type { DemoSeed } from './demo-app';
import { useDemo } from './demo-provider';

const statusOptions: Array<{ value: ModuleStatus; label: string }> = [
  { value: 'not_started', label: 'Not started' },
  { value: 'learning', label: 'Learning' },
  { value: 'exercise', label: 'Exercise' },
  { value: 'done', label: 'Done' },
];

export function DemoRoadmap({ seed }: { seed: Pick<DemoSeed, 'roadmap' | 'courseUnits' | 'modules'> }) {
  const { state, setModuleStatus } = useDemo();
  const [query, setQuery] = useState('');
  const roadmaps = useMemo(() => new Map(seed.roadmap.map((item) => [item.id, item])), [seed.roadmap]);
  const courseUnits = useMemo(() => new Map(seed.courseUnits.map((unit) => [unit.id, unit])), [seed.courseUnits]);
  const visibleModules = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return seed.modules;
    return seed.modules.filter((module) => {
      const roadmap = roadmaps.get(module.roadmapId);
      const course = courseUnits.get(module.courseUnitId);
      return [roadmap?.phaseLabel, roadmap?.title, course?.title, module.title]
        .some((text) => text?.toLocaleLowerCase().includes(normalizedQuery));
    });
  }, [courseUnits, query, roadmaps, seed.modules]);

  return (
    <section aria-labelledby="demo-roadmap-title" className="space-y-5">
      <div>
        <h2 id="demo-roadmap-title" className="text-2xl font-bold tracking-tight">Browse the roadmap</h2>
        <p className="mt-2 text-sm text-muted-foreground">The curriculum is read-only; only your local module status can change.</p>
      </div>
      <label className="relative block max-w-xl">
        <span className="sr-only">Search curriculum</span>
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <Input type="search" aria-label="Search curriculum" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search phases, courses, or modules" className="pl-9" />
      </label>

      {visibleModules.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">No curriculum items match that search.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {visibleModules.map((module) => {
            const roadmap = roadmaps.get(module.roadmapId);
            const course = courseUnits.get(module.courseUnitId);
            return (
              <Card key={module.id}>
                <CardHeader className="pb-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">{roadmap?.phaseLabel}</p>
                  <CardTitle className="text-base">{module.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{roadmap?.title} · {course?.title}</p>
                  <label className="block text-sm font-medium">
                    <span className="sr-only">Status for {module.title}</span>
                    <select
                      aria-label={`Status for ${module.title}`}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={state.moduleStatusOverrides[module.id] ?? 'not_started'}
                      onChange={(event) => setModuleStatus(module.id, event.target.value as ModuleStatus)}
                    >
                      {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
