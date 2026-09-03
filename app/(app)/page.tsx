'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { ArrowRight, BookOpenCheck, CheckCircle2, ClipboardPen, Flame, GraduationCap, Layers, Loader2, Sparkles, Trophy, Upload, Zap } from 'lucide-react';
import { useCurriculumTree, useSetModuleStatus } from '@/lib/hooks/useCurriculum';
import { useActivity, useStreak, useXp, type ActivityEvent } from '@/lib/hooks/useGamification';
import { STATUS_META, type ModuleStatus } from '@/lib/curriculum';
import { StatusControl } from '@/components/roadmap/status-control';
import { ExerciseReportDrawer, type ReportContext } from '@/components/roadmap/exercise-report-drawer';
import { ActivityHeatmap, MilestoneBadges, NearestAchievements, WeekChart } from '@/components/dashboard/widgets';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { safeExternalUrl } from '@/lib/security/url';

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Burning the midnight oil';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function activityText(e: ActivityEvent): string {
  const p = e.payload || {};
  switch (e.event_type) {
    case 'module_completed': return `Completed “${p.title}”`;
    case 'module_status_changed': return `${p.title} → ${STATUS_META[p.status as ModuleStatus]?.label ?? p.status}`;
    case 'unit_completed': return `Finished course “${p.title}”`;
    case 'phase_completed': return `Phase complete: ${p.title}`;
    case 'study_logged': return `Logged ${p.minutes} min${p.topic ? ` on ${p.topic}` : ''}`;
    case 'exercise_reported': return `Exercise report: ${p.activity_title || p.module_title}`;
    case 'achievement_earned': return `Achievement unlocked: ${p.title}${p.xp ? ` (+${p.xp} XP)` : ''}`;
    default: return e.event_type.replace(/_/g, ' ');
  }
}

function StatCard({ icon: Icon, label, value, sub, progress, tone, testId }: { icon: any; label: string; value: React.ReactNode; sub?: React.ReactNode; progress?: number; tone?: string; testId?: string }) {
  return (
    <Card data-testid={testId}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{label}</p>
          <span className={cn('inline-flex h-8 w-8 items-center justify-center rounded-md', tone || 'bg-primary/10 text-primary')}><Icon className="h-4 w-4" /></span>
        </div>
        <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight">{value}</p>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
        {typeof progress === 'number' && <Progress value={progress} className="mt-3 h-1.5" />}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { tree, isLoading, error } = useCurriculumTree();
  const xp = useXp();
  const { streak } = useStreak();
  const activity = useActivity(10);
  const setStatus = useSetModuleStatus();
  const [report, setReport] = useState<ReportContext>(null);

  const name = 'Yuta';

  if (isLoading) {
    return <div className="flex items-center gap-2 text-muted-foreground p-8"><Loader2 className="h-4 w-4 animate-spin" /> Loading your lab…</div>;
  }

  const empty = !tree || tree.phases.length === 0;
  const t = tree?.totals;
  const target = tree?.continueTarget;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{greeting()}, {name}.</h1>
        <p className="text-muted-foreground">Your Healthcare AI journey, one module at a time.</p>
      </div>

      {error && (
        <Card className="border-destructive/40"><CardContent className="p-5 text-sm">
          <p className="font-medium">Could not load curriculum: {(error as Error).message}</p>
          <p className="text-muted-foreground mt-1">Make sure <code>supabase/migrations/001_init.sql</code> has been applied.</p>
        </CardContent></Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Zap} label={`Level ${xp.level.level}`} value={`${xp.level.xp} XP`} sub={`${xp.level.title} · ${xp.level.remaining} XP to level ${xp.level.level + 1}`} progress={Math.round(xp.level.progress * 100)} tone="bg-violet-100 text-violet-700" testId="stat-level" />
        <StatCard icon={Flame} label="Streak" value={`${streak.current} day${streak.current === 1 ? '' : 's'}`} sub={streak.activeToday ? 'Active today — keep it going!' : streak.current > 0 ? 'Log progress today to extend it' : `Longest: ${streak.longest} days`} tone="bg-orange-100 text-orange-600" testId="stat-streak" />
        <StatCard icon={CheckCircle2} label="Modules done" value={t ? `${t.modulesDone}/${t.modules}` : '—'} sub={t ? `${t.weightedPercent}% weighted progress · ${t.modulesInProgress} in progress` : 'No curriculum imported'} progress={t?.weightedPercent ?? 0} tone="bg-emerald-100 text-emerald-700" testId="stat-modules" />
        <StatCard icon={Layers} label="Courses & phases" value={t ? `${t.unitsDone}/${t.units}` : '—'} sub={t ? `${t.phasesDone}/${t.phases} phases complete · ${t.phasesInProgress} active` : ''} progress={t && t.units ? Math.round((t.unitsDone / t.units) * 100) : 0} tone="bg-sky-100 text-sky-700" testId="stat-courses" />
      </div>

      {empty ? (
        <Card className="border-dashed">
          <CardContent className="p-10 text-center space-y-4">
            <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
            <div>
              <p className="font-medium">Start by importing your curriculum</p>
              <p className="text-sm text-muted-foreground">The Yuta&apos;s Lab seed contains 14 phases, 58 courses and 265 modules from IBM, DeepLearning.AI, Stanford, Johns Hopkins and more.</p>
            </div>
            <Button asChild data-testid="dashboard-import-cta"><Link href="/settings">Go to import <ArrowRight className="h-4 w-4 ml-1" /></Link></Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2 overflow-hidden" data-testid="continue-card">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-primary"><Sparkles className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-wider">Continue where you left off</span></div>
              {target ? (
                <>
                  <CardDescription>{target.phase.phase_label} · {target.unit.title}</CardDescription>
                  <CardTitle className="text-xl leading-snug">{target.module.title}</CardTitle>
                </>
              ) : (
                <CardTitle className="text-xl">Everything is complete. Legendary.</CardTitle>
              )}
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
                  <StatusControl
                    value={target.module.status}
                    disabled={setStatus.isPending}
                    moduleKey={`continue-${target.module.key}`}
                    onChange={(s) => setStatus.mutate({ moduleId: target.module.id, status: s }, {
                      onSuccess: () => s === 'done' ? toast.success(`Completed “${target.module.title}”`, { description: `+${target.module.xp_value} XP` }) : toast(`Marked as ${STATUS_META[s].label}`),
                      onError: (e: any) => toast.error('Could not update module', { description: e?.message }),
                    })}
                  />
                  <Button variant="outline" size="sm" data-testid="continue-report" onClick={() => setReport({ module: target.module, unitTitle: target.unit.title, phaseLabel: target.phase.phase_label })}>
                    <ClipboardPen className="h-3.5 w-3.5 mr-1" /> Log exercise
                  </Button>
                  {safeExternalUrl(target.module.source_url) && (
                    <Button asChild variant="outline" size="sm"><a href={safeExternalUrl(target.module.source_url)!} target="_blank" rel="noopener noreferrer">Open course <ArrowRight className="h-3.5 w-3.5 ml-1" /></a></Button>
                  )}
                  <Button asChild variant="ghost" size="sm" className="ml-auto"><Link href={`/roadmap#phase-${target.phase.key}`}>View in roadmap</Link></Button>
                </div>
              </CardContent>
            )}
          </Card>

          <Card data-testid="recent-activity">
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Trophy className="h-4 w-4 text-primary" /> Recent activity</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {activity.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
              {!activity.isLoading && (activity.data || []).length === 0 && <p className="text-sm text-muted-foreground">No activity yet. Mark a module as Learning to begin.</p>}
              {(activity.data || []).map((e) => (
                <div key={e.id} className="flex gap-3 text-sm">
                  <span className={cn('mt-1.5 h-2 w-2 rounded-full shrink-0', e.event_type.includes('completed') ? 'bg-emerald-500' : 'bg-primary/60')} />
                  <div className="min-w-0">
                    <p className="leading-snug truncate">{activityText(e)}</p>
                    <p className="text-[11px] text-muted-foreground">{formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {!empty && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2"><WeekChart /></div>
          <NearestAchievements />
        </div>
      )}

      {!empty && <MilestoneBadges tree={tree} />}

      {!empty && <ActivityHeatmap />}

      {!empty && tree && (
        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2"><GraduationCap className="h-4 w-4 text-primary" /> Phase overview</CardTitle>
            <Button asChild variant="ghost" size="sm"><Link href="/roadmap">Open roadmap <ArrowRight className="h-3.5 w-3.5 ml-1" /></Link></Button>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tree.phases.map((p) => (
              <Link key={p.id} href={`/roadmap#phase-${p.key}`} className="rounded-lg border p-3 hover:bg-muted/50 transition-colors" data-testid={`overview-${p.key}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">{p.phase_label || `Phase ${p.index}`}</p>
                  <span className={cn('text-xs font-semibold tabular-nums', p.status === 'completed' ? 'text-emerald-600' : '')}>{p.percent}%</span>
                </div>
                <p className="text-sm font-medium leading-snug mt-0.5 line-clamp-2">{p.title}</p>
                <Progress value={p.percent} className="mt-2 h-1.5" />
                <p className="text-[11px] text-muted-foreground mt-1">{p.done}/{p.total} modules · {p.units.length} courses</p>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <ExerciseReportDrawer context={report} onClose={() => setReport(null)} />
    </div>
  );
}
