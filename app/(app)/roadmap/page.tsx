'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { BookOpenCheck, Loader2, Route, Search, Sparkles, Upload } from 'lucide-react';
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
      <Card className="border-rose-200/70 bg-gradient-to-br from-rose-50 via-white to-card dark:border-rose-500/25 dark:from-rose-500/15 dark:via-card dark:to-card"><CardContent className="p-6 space-y-2">
        <p className="font-medium">Could not load your roadmap</p>
        <p className="text-sm text-muted-foreground">Something went wrong. Please refresh and try again in a moment.</p>
      </CardContent></Card>
    );
  }
  if (!tree || tree.phases.length === 0) {
    return (
      <Card className="card-lift overflow-hidden border-dashed border-violet-300/70 bg-gradient-to-br from-violet-50 via-white to-sky-50 dark:border-violet-500/30 dark:from-violet-500/15 dark:via-card dark:to-sky-500/10"><CardContent className="p-10 text-center space-y-4">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500 text-white shadow-lg shadow-violet-500/30"><Upload className="h-6 w-6" /></span>
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
      <Card className="pop-in card-lift relative overflow-hidden border-violet-200/70 bg-gradient-to-br from-violet-50 via-white to-sky-50 dark:border-violet-500/25 dark:from-violet-500/15 dark:via-card dark:to-sky-500/10">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-fun" />
        <Route aria-hidden="true" className="pointer-events-none absolute right-[23rem] top-1/2 z-0 hidden h-32 w-32 -translate-y-1/2 rotate-12 text-violet-500 opacity-[0.04] xl:block" />
        <CardContent className="relative z-10 flex flex-col gap-6 p-6 pt-8 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-500 text-white shadow-lg shadow-violet-500/30">
              <Route className="h-6 w-6" />
            </span>
            <div>
              <div className="mb-1 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-[0.16em] text-violet-700 dark:text-violet-300">
                <Sparkles className="h-3.5 w-3.5" /> Your learning adventure
              </div>
              <h1 className="text-3xl font-black tracking-tight md:text-4xl"><span className="text-gradient">Roadmap</span></h1>
              <p className="mt-1 text-sm text-muted-foreground">{t.phases} phases · {t.units} courses · {t.modules} modules</p>
            </div>
          </div>
          <div className="relative z-20 rounded-2xl border border-white/70 bg-background/90 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-background/80 md:w-80">
            <div className="mb-2 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Overall progress</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{t.modulesDone} done · {t.modulesInProgress} in progress</p>
              </div>
              <span className="text-3xl font-black tabular-nums text-violet-700 dark:text-violet-300" data-testid="overall-percent">{t.weightedPercent}%</span>
            </div>
            <Progress value={t.weightedPercent} className="h-2.5 [&>div]:bg-gradient-to-r [&>div]:from-violet-500 [&>div]:via-sky-500 [&>div]:to-emerald-500" />
          </div>
        </CardContent>
      </Card>

      <Card className="card-lift pop-in overflow-hidden border-sky-200/70 bg-gradient-to-r from-sky-50/80 via-card to-teal-50/70 dark:border-sky-500/20 dark:from-sky-500/10 dark:via-card dark:to-teal-500/10">
        <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 px-1 text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300">
            <BookOpenCheck className="h-4 w-4" /> Explore
          </div>
          <div className="flex flex-wrap gap-1 rounded-xl border bg-background/70 p-1 shadow-sm">
            {FILTERS.map((f) => (
              <button key={f.key} type="button" onClick={() => setFilter(f.key)} aria-pressed={filter === f.key} data-testid={`filter-${f.key}`}
                className={cn('rounded-lg px-3 py-1.5 text-sm transition-all', filter === f.key ? 'bg-sky-500 text-white shadow-sm font-bold' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative sm:ml-auto sm:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-sky-600 dark:text-sky-300" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search courses & modules…" className="border-sky-200/80 bg-background/80 pl-9 shadow-sm dark:border-sky-500/20" data-testid="roadmap-search" />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4 pop-in">
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
