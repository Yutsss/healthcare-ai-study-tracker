'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { ArrowRight, CheckCircle2, ClipboardPen, Flame, GraduationCap, Layers, Loader2, Sparkles, Trophy, Upload, Zap } from 'lucide-react';
import { STATUS_META, type CurriculumTree, type ModuleStatus } from '@/lib/curriculum';
import type { LabExerciseReport, LabProgressionView, LabStudyLog, NewLabExerciseReport } from '@/lib/lab/types';
import type { LabRouteMap } from '@/lib/lab/routes';
import { StatusControl } from '@/components/roadmap/status-control';
import { ExerciseReportDrawer, type ReportContext } from '@/components/roadmap/exercise-report-drawer';
import { ActivityHeatmap, MilestoneBadges, NearestAchievements, WeekChart } from '@/components/dashboard/widgets';
import { WeeklyQuests } from '@/components/dashboard/weekly-quests';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { safeExternalUrl } from '@/lib/security/url';

export type ModuleStatusAction = (moduleId: string, status: ModuleStatus) => Promise<void>;
export type ExerciseReportAction = (input: NewLabExerciseReport) => Promise<void>;

export type DashboardScreenProps = {
  mode: 'owner' | 'demo';
  name: string;
  routes: LabRouteMap;
  tree: CurriculumTree | null;
  loading: boolean;
  error: boolean;
  progression: LabProgressionView;
  progressionLoading: boolean;
  logs: LabStudyLog[];
  reports: LabExerciseReport[];
  weeklyGoal: number;
  onSetModuleStatus: ModuleStatusAction;
  onCreateReport: ExerciseReportAction;
};

function greeting() {
  const hour = new Date().getHours();
  if (hour < 5) return { text: 'Burning the midnight oil', emoji: '🌙' };
  if (hour < 12) return { text: 'Good morning', emoji: '☀️' };
  if (hour < 18) return { text: 'Good afternoon', emoji: '🧪' };
  return { text: 'Good evening', emoji: '✨' };
}

function activityText(event: LabProgressionView['activity'][number]): string {
  const payload = event.payload || {};
  switch (event.event_type) {
    case 'module_completed': return `Completed “${payload.title}”`;
    case 'module_status_changed': return `${payload.title} → ${STATUS_META[payload.status as ModuleStatus]?.label ?? payload.status}`;
    case 'unit_completed': return `Finished course “${payload.title}”`;
    case 'phase_completed': return `Phase complete: ${payload.title}`;
    case 'study_logged': return `Logged ${payload.minutes} min${payload.topic ? ` on ${payload.topic}` : ''}`;
    case 'exercise_reported': return `Exercise report: ${payload.activity_title || payload.module_title}`;
    case 'achievement_earned': return `Achievement unlocked: ${payload.title}${payload.xp ? ` (+${payload.xp} XP)` : ''}`;
    case 'quest_completed': return `Weekly quest complete: ${payload.title}${payload.xp ? ` (+${payload.xp} XP)` : ''}`;
    case 'project_completed': return `Project completed: ${payload.title}`;
    case 'project_created': return `New project: ${payload.title}`;
    case 'project_status_changed': return `${payload.title} → ${String(payload.status || '').replace('_', ' ')}`;
    default: return event.event_type.replace(/_/g, ' ');
  }
}

const TONES: Record<string, { chip: string; card: string; bar: string }> = {
  violet: { chip: 'bg-violet-500 text-white shadow-violet-500/40', card: 'from-violet-50 to-white dark:from-violet-500/10 dark:to-card border-violet-200/60 dark:border-violet-500/20', bar: '[&>div]:bg-violet-500' },
  orange: { chip: 'bg-orange-500 text-white shadow-orange-500/40', card: 'from-orange-50 to-white dark:from-orange-500/10 dark:to-card border-orange-200/60 dark:border-orange-500/20', bar: '[&>div]:bg-orange-500' },
  emerald: { chip: 'bg-emerald-500 text-white shadow-emerald-500/40', card: 'from-emerald-50 to-white dark:from-emerald-500/10 dark:to-card border-emerald-200/60 dark:border-emerald-500/20', bar: '[&>div]:bg-emerald-500' },
  sky: { chip: 'bg-sky-500 text-white shadow-sky-500/40', card: 'from-sky-50 to-white dark:from-sky-500/10 dark:to-card border-sky-200/60 dark:border-sky-500/20', bar: '[&>div]:bg-sky-500' },
};

function StatCard({ icon: Icon, label, value, sub, progress, tone = 'violet', testId }: { icon: any; label: string; value: React.ReactNode; sub?: React.ReactNode; progress?: number; tone?: keyof typeof TONES; testId?: string }) {
  const selectedTone = TONES[tone] || TONES.violet;
  return (
    <Card data-testid={testId} className={cn('card-lift group relative overflow-hidden bg-gradient-to-br', selectedTone.card)}>
      <Icon className="pointer-events-none absolute -right-4 -bottom-4 h-24 w-24 opacity-[0.06] transition-transform duration-500 group-hover:scale-125 group-hover:-rotate-12" />
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-muted-foreground">{label}</p>
          <span className={cn('inline-flex h-9 w-9 items-center justify-center rounded-xl shadow-md transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6', selectedTone.chip)}><Icon className="h-4 w-4" /></span>
        </div>
        <p className="mt-2 text-3xl font-black tabular-nums tracking-tight">{value}</p>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
        {typeof progress === 'number' && <Progress value={progress} className={cn('mt-3 h-2', selectedTone.bar)} />}
      </CardContent>
    </Card>
  );
}

export function DashboardScreen({
  mode, name, routes, tree, loading, error, progression, progressionLoading,
  logs, reports, weeklyGoal, onSetModuleStatus, onCreateReport,
}: DashboardScreenProps) {
  const [report, setReport] = useState<ReportContext>(null);
  const [busy, setBusy] = useState(false);

  if (loading) {
    return <div className="flex items-center gap-2 p-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading your lab…</div>;
  }

  const empty = !tree || tree.phases.length === 0;
  const totals = tree?.totals;
  const target = tree?.continueTarget;
  const weekStart = progression.quests[0]?.week_start ?? new Date().toISOString().slice(0, 10);

  async function setModuleStatus(moduleId: string, status: ModuleStatus, title: string, xpValue: number) {
    setBusy(true);
    try {
      await onSetModuleStatus(moduleId, status);
      if (status === 'done') toast.success(`Completed “${title}”`, { description: `+${xpValue} XP` });
      else toast(`Marked as ${STATUS_META[status].label}`);
    } catch (cause: any) {
      toast.error('Could not update module', { description: cause?.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 pop-in">
        <p className="text-sm font-semibold text-muted-foreground">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        <h1 className="text-3xl font-black tracking-tight md:text-4xl">
          <span className="mr-2 inline-block animate-float">{greeting().emoji}</span>
          {greeting().text}, <span className="text-gradient">{name}</span>.
        </h1>
        <p className="text-muted-foreground">Your Healthcare AI journey, one module at a time.</p>
      </div>

      {error && (
        <Card className="border-destructive/40"><CardContent className="p-5 text-sm">
          <p className="font-medium">Could not load your data</p>
          <p className="mt-1 text-muted-foreground">Something went wrong. Please refresh and try again in a moment.</p>
        </CardContent></Card>
      )}

      <div className="grid gap-4 pop-in sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Zap} label={`Level ${progression.level.level}`} value={`${progression.level.xp} XP`} sub={`${progression.level.title} · ${progression.level.remaining} XP to level ${progression.level.level + 1}`} progress={Math.round(progression.level.progress * 100)} tone="violet" testId="stat-level" />
        <StatCard icon={Flame} label="Streak" value={`${progression.streak.current} day${progression.streak.current === 1 ? '' : 's'}`} sub={progression.streak.activeToday ? 'Active today — keep it going!' : progression.streak.current > 0 ? 'Log progress today to extend it' : `Longest: ${progression.streak.longest} days`} tone="orange" testId="stat-streak" />
        <StatCard icon={CheckCircle2} label="Modules done" value={totals ? `${totals.modulesDone}/${totals.modules}` : '—'} sub={totals ? `${totals.weightedPercent}% weighted progress · ${totals.modulesInProgress} in progress` : 'No curriculum imported'} progress={totals?.weightedPercent ?? 0} tone="emerald" testId="stat-modules" />
        <StatCard icon={Layers} label="Courses & phases" value={totals ? `${totals.unitsDone}/${totals.units}` : '—'} sub={totals ? `${totals.phasesDone}/${totals.phases} phases complete · ${totals.phasesInProgress} active` : ''} progress={totals?.units ? Math.round((totals.unitsDone / totals.units) * 100) : 0} tone="sky" testId="stat-courses" />
      </div>

      {empty ? (
        <Card className="border-dashed"><CardContent className="space-y-4 p-10 text-center">
          <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
          <div>
            <p className="font-medium">{mode === 'owner' ? 'Start by importing your curriculum' : 'Demo curriculum is unavailable'}</p>
            <p className="text-sm text-muted-foreground">The Yuta&apos;s Lab curriculum contains 14 phases, 58 courses and 265 modules.</p>
          </div>
          {mode === 'owner' && <Button asChild data-testid="dashboard-import-cta"><Link href="/settings">Go to import <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>}
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="card-lift relative overflow-hidden lg:col-span-2" data-testid="continue-card">
            <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-fun" />
            <CardHeader className="pb-3 pt-7">
              <div className="flex items-center gap-2 text-primary"><Sparkles className="h-4 w-4 animate-float" /><span className="text-xs font-extrabold uppercase tracking-wider">Continue where you left off</span></div>
              {target ? <><CardDescription>{target.phase.phase_label} · {target.unit.title}</CardDescription><CardTitle className="text-xl leading-snug">{target.module.title}</CardTitle></> : <CardTitle className="text-xl">Everything is complete. Legendary.</CardTitle>}
            </CardHeader>
            {target && (
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{STATUS_META[target.module.status].label}</Badge>
                  <Badge variant="outline">{target.module.xp_value} XP</Badge>
                  {target.phase.provider && <Badge variant="outline">{target.phase.provider}</Badge>}
                  <span className="text-xs text-muted-foreground">Course progress {target.unit.done}/{target.unit.total}</span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <StatusControl value={target.module.status} disabled={busy} moduleKey={`continue-${target.module.key}`} onChange={(status) => void setModuleStatus(target.module.id, status, target.module.title, target.module.xp_value)} />
                  <Button variant="outline" size="sm" data-testid="continue-report" onClick={() => setReport({ module: target.module, unitTitle: target.unit.title, phaseLabel: target.phase.phase_label })}><ClipboardPen className="mr-1 h-3.5 w-3.5" /> Log exercise</Button>
                  {safeExternalUrl(target.module.source_url) && <Button asChild variant="outline" size="sm"><a href={safeExternalUrl(target.module.source_url)!} target="_blank" rel="noopener noreferrer">Open course <ArrowRight className="ml-1 h-3.5 w-3.5" /></a></Button>}
                  <Button asChild variant="ghost" size="sm" className="ml-auto"><Link href={`${routes.roadmap}#phase-${target.phase.key}`}>View in roadmap</Link></Button>
                </div>
              </CardContent>
            )}
          </Card>

          <Card data-testid="recent-activity">
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Trophy className="h-4 w-4 text-primary" /> Recent activity</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {progressionLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
              {!progressionLoading && progression.activity.length === 0 && <p className="text-sm text-muted-foreground">No activity yet. Mark a module as Learning to begin.</p>}
              {progression.activity.slice(0, 10).map((event) => (
                <div key={event.id} className="flex gap-3 text-sm">
                  <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', event.event_type.includes('completed') ? 'bg-emerald-500' : 'bg-primary/60')} />
                  <div className="min-w-0"><p className="truncate leading-snug">{activityText(event)}</p><p className="text-[11px] text-muted-foreground">{formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}</p></div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {!empty && <div className="grid items-start gap-4 lg:grid-cols-3"><div className="lg:col-span-2"><WeekChart logs={logs} reports={reports} weeklyGoal={weeklyGoal} /></div><WeeklyQuests quests={progression.quests} isLoading={progressionLoading} weekStart={weekStart} /></div>}
      {!empty && <div className="grid items-start gap-4 lg:grid-cols-3"><div className="lg:col-span-2"><MilestoneBadges items={progression.milestones} isLoading={progressionLoading} /></div><NearestAchievements items={progression.achievements} isLoading={progressionLoading} routes={routes} /></div>}
      {!empty && <ActivityHeatmap activityDates={progression.activity.map((event) => event.created_at)} logs={logs} streak={progression.streak} />}

      {!empty && tree && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3"><CardTitle className="flex items-center gap-2 text-base"><GraduationCap className="h-4 w-4 text-primary" /> Phase overview</CardTitle><Button asChild variant="ghost" size="sm"><Link href={routes.roadmap}>Open roadmap <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link></Button></CardHeader>
          <CardContent className="grid gap-3 pop-in sm:grid-cols-2 lg:grid-cols-3">
            {tree.phases.map((phase) => (
              <Link key={phase.id} href={`${routes.roadmap}#phase-${phase.key}`} className={cn('card-lift rounded-xl border bg-card p-3 hover:border-primary/40', phase.status === 'completed' && 'border-emerald-200/70 bg-gradient-to-br from-emerald-50 to-card dark:from-emerald-500/10')} data-testid={`overview-${phase.key}`}>
                <div className="flex items-center justify-between gap-2"><p className="truncate text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{phase.phase_label || `Phase ${phase.index}`}</p><span className={cn('rounded-full px-2 py-0.5 text-xs font-bold tabular-nums', phase.status === 'completed' ? 'bg-emerald-500 text-white' : phase.percent > 0 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>{phase.status === 'completed' ? '✓ 100%' : `${phase.percent}%`}</span></div>
                <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug">{phase.title}</p><Progress value={phase.percent} className="mt-2 h-2" /><p className="mt-1 text-[11px] text-muted-foreground">{phase.done}/{phase.total} modules · {phase.units.length} courses</p>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <ExerciseReportDrawer context={report} onClose={() => setReport(null)} reports={reports} onCreateReport={onCreateReport} onSetModuleStatus={onSetModuleStatus} busy={busy} />
    </div>
  );
}
