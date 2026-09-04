'use client';

import React from 'react';
import { LockKeyhole, RotateCcw, ShieldCheck } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { DemoStarterProject } from '@/lib/demo/state';
import { DemoDashboard } from './demo-dashboard';
import { DemoLog } from './demo-log';
import { DemoProjects } from './demo-projects';
import { DemoProvider, useDemo } from './demo-provider';
import { DemoRoadmap } from './demo-roadmap';

export type DemoSeed = {
  roadmap: Array<{ id: string; title: string; phaseLabel: string; order: number; provider: string; category: string }>;
  courseUnits: Array<{ id: string; roadmapId: string; title: string; order: number }>;
  modules: Array<{ id: string; roadmapId: string; courseUnitId: string; title: string; order: number }>;
  starterProjects: DemoStarterProject[];
};

function DemoWorkspace({ seed }: { seed: DemoSeed }) {
  const { reset, storageWarning } = useDemo();
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-2xl">
            <Badge className="mb-3 gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Your private demo</Badge>
            <h1 className="text-3xl font-bold tracking-tight">Explore Yuta&apos;s Lab with local sample data</h1>
            <p className="mt-2 text-muted-foreground">Try progress tracking, study logs, and project planning. Your changes remain in this browser and never affect the owner account.</p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild><Button type="button" variant="outline"><RotateCcw /> Reset demo</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset your local demo?</AlertDialogTitle>
                <AlertDialogDescription>This removes your demo changes from this browser and restores the starter project.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={reset}>Reset local demo</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-muted-foreground"><LockKeyhole className="h-3.5 w-3.5" /> Curriculum administration — Locked</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-muted-foreground"><LockKeyhole className="h-3.5 w-3.5" /> Settings — Locked</span>
        </div>
        {storageWarning && <p role="status" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{storageWarning}</p>}
      </section>

      <Tabs defaultValue="dashboard">
        <TabsList aria-label="Demo sections" className="h-auto w-full flex-wrap justify-start gap-1 p-1.5">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="roadmap">Roadmap</TabsTrigger>
          <TabsTrigger value="log">Study Log</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard" className="mt-6"><DemoDashboard /></TabsContent>
        <TabsContent value="roadmap" className="mt-6"><DemoRoadmap seed={seed} /></TabsContent>
        <TabsContent value="log" className="mt-6"><DemoLog modules={seed.modules} /></TabsContent>
        <TabsContent value="projects" className="mt-6"><DemoProjects /></TabsContent>
        <TabsContent value="progress" className="mt-6"><DemoDashboard progressView /></TabsContent>
      </Tabs>
    </div>
  );
}

export function DemoApp({ seed }: { seed: DemoSeed }) {
  return (
    <DemoProvider moduleIds={seed.modules.map((module) => module.id)} starterProjects={seed.starterProjects}>
      <DemoWorkspace seed={seed} />
    </DemoProvider>
  );
}
