'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Loader2, Search, Upload } from 'lucide-react';
import { useCurriculumTree, useSetModuleStatus } from '@/lib/hooks/useCurriculum';
import { STATUS_META, type ModuleNode, type ModuleStatus, type NodeStatus, type PhaseNode, type UnitNode } from '@/lib/curriculum';
import { PhaseCard } from '@/components/roadmap/phase-card';
import { ExerciseReportDrawer, type ReportContext } from '@/components/roadmap/exercise-report-drawer';
import { useExerciseReports } from '@/lib/hooks/useExerciseReports';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Filter = 'all' | NodeStatus;
const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: 'All phases' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'not_started', label: 'Not started' },
  { key: 'completed', label: 'Completed' },
];

function filterTree(phases: PhaseNode[], filter: Filter, query: string): PhaseNode[] {
  const q = query.trim().toLowerCase();
  return phases
    .filter((p) => filter === 'all' || p.status === filter)
    .map((p) => {
      if (!q) return p;
      const phaseMatch = p.title.toLowerCase().includes(q) || (p.phase_label || '').toLowerCase().includes(q);
      const units = p.units
        .map((u) => {
          const unitMatch = u.title.toLowerCase().includes(q);
          const modules = u.modules.filter((m) => m.title.toLowerCase().includes(q));
          if (unitMatch || phaseMatch) return u;
          if (modules.length) return { ...u, modules };
          return null;
        })
        .filter(Boolean) as PhaseNode['units'];
      if (!phaseMatch && units.length === 0) return null;
      return { ...p, units };
    })
    .filter(Boolean) as PhaseNode[];
}

export default function RoadmapPage() {
  const { tree, isLoading, error } = useCurriculumTree();
  const setStatus = useSetModuleStatus();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [openPhases, setOpenPhases] = useState<Set<string>>(new Set());
  const [initialised, setInitialised] = useState(false);
  const [report, setReport] = useState<ReportContext>(null);
  const { byModule } = useExerciseReports();
  const reportCounts = useMemo(() => { const m = new Map<string, number>(); byModule.forEach((v, k) => m.set(k, v.length)); return m; }, [byModule]);

  function onReport(module: ModuleNode, unit: UnitNode, phase?: PhaseNode) {
    setReport({ module, unitTitle: unit.title, phaseLabel: phase?.phase_label });
  }

  // Open the phase you should continue with by default
  useEffect(() => {
    if (tree && !initialised) {
      const target = tree.continueTarget;
      if (target) setOpenPhases(new Set([target.phase.id]));
      setInitialised(true);
    }
  }, [tree, initialised]);

  const visible = useMemo(() => (tree ? filterTree(tree.phases, filter, query) : []), [tree, filter, query]);
  const searching = query.trim().length > 0;

  function onStatus(module: ModuleNode, status: ModuleStatus) {
    setStatus.mutate(
      { moduleId: module.id, status },
      {
        onSuccess: () => {
          if (status === 'done') toast.success(`Completed “${module.title}”`, { description: `+${module.xp_value} XP` });
          else toast(`${module.title}`, { description: `Marked as ${STATUS_META[status].label}` });
        },
        onError: (e: any) => toast.error('Could not update module', { description: e?.message }),
      }
    );
  }

  function togglePhase(id: string) {
    setOpenPhases((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  if (isLoading) {
    return <div className="flex items-center gap-2 text-muted-foreground p-8"><Loader2 className="h-4 w-4 animate-spin" /> Loading curriculum…</div>;
  }
  if (error) {
    return (
      <Card><CardContent className="p-6 space-y-2">
        <p className="font-medium">Could not load your roadmap</p>
        <p className="text-sm text-muted-foreground">Something went wrong. Please refresh and try again in a moment.</p>
      </CardContent></Card>
    );
  }
  if (!tree || tree.phases.length === 0) {
    return (
      <Card className="border-dashed"><CardContent className="p-10 text-center space-y-4">
        <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
        <div>
          <p className="font-medium">Your roadmap is empty</p>
          <p className="text-sm text-muted-foreground">Import the Yuta&apos;s Lab course seed (14 phases, 58 courses, 265 modules) to get started.</p>
        </div>
        <Button asChild data-testid="go-to-import"><Link href="/settings">Import curriculum</Link></Button>
      </CardContent></Card>
    );
  }

  const t = tree.totals;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Roadmap</h1>
          <p className="text-sm text-muted-foreground">{t.phases} phases · {t.units} courses · {t.modules} modules</p>
        </div>
        <div className="md:w-80">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground">Overall progress</span>
            <span className="font-semibold" data-testid="overall-percent">{t.weightedPercent}%</span>
          </div>
          <Progress value={t.weightedPercent} className="h-2" />
          <p className="text-[11px] text-muted-foreground mt-1">{t.modulesDone} done · {t.modulesInProgress} in progress</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" onClick={() => setFilter(f.key)} data-testid={`filter-${f.key}`}
              className={cn('rounded-md px-3 py-1.5 text-sm transition-colors', filter === f.key ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground')}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative sm:ml-auto sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search courses & modules…" className="pl-8" data-testid="roadmap-search" />
        </div>
      </div>

      <div className="space-y-3">
        {visible.length === 0 && <p className="text-sm text-muted-foreground p-6 text-center">Nothing matches this filter.</p>}
        {visible.map((phase) => (
          <PhaseCard
            key={phase.id}
            phase={phase}
            open={searching || openPhases.has(phase.id)}
            onToggle={() => togglePhase(phase.id)}
            onStatus={onStatus}
            onReport={onReport}
            reportCounts={reportCounts}
            busy={setStatus.isPending}
            forceOpenUnits={searching}
            openUnitIds={tree.continueTarget && tree.continueTarget.phase.id === phase.id ? new Set([tree.continueTarget.unit.id]) : undefined}
          />
        ))}
      </div>

      <ExerciseReportDrawer context={report} onClose={() => setReport(null)} />
    </div>
  );
}
