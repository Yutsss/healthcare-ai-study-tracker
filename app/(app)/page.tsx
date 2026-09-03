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
import { WeeklyQuests } from '@/components/dashboard/weekly-quests';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { safeExternalUrl } from '@/lib/security/url';

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return { text: 'Burning the midnight oil', emoji: '🌙' };
  if (h < 12) return { text: 'Good morning', emoji: '☀️' };
  if (h < 18) return { text: 'Good afternoon', emoji: '🧪' };
  return { text: 'Good evening', emoji: '✨' };
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
    case 'quest_completed': return `Weekly quest complete: ${p.title}${p.xp ? ` (+${p.xp} XP)` : ''}`;
    case 'project_completed': return `Project completed: ${p.title}`;
    case 'project_created': return `New project: ${p.title}`;
    case 'project_status_changed': return `${p.title} → ${String(p.status || '').replace('_', ' ')}`;
    default: return e.event_type.replace(/_/g, ' ');
  }
}

const TONES: Record<string, { chip: string; card: string; bar: string }> = {
  violet: { chip: 'bg-violet-500 text-white shadow-violet-500/40', card: 'from-violet-50 to-white dark:from-violet-500/10 dark:to-card border-violet-200/60 dark:border-violet-500/20', bar: '[&>div]:bg-violet-500' },
  orange: { chip: 'bg-orange-500 text-white shadow-orange-500/40', card: 'from-orange-50 to-white dark:from-orange-500/10 dark:to-card border-orange-200/60 dark:border-orange-500/20', bar: '[&>div]:bg-orange-500' },
  emerald: { chip: 'bg-emerald-500 text-white shadow-emerald-500/40', card: 'from-emerald-50 to-white dark:from-emerald-500/10 dark:to-card border-emerald-200/60 dark:border-emerald-500/20', bar: '[&>div]:bg-emerald-500' },
  sky: { chip: 'bg-sky-500 text-white shadow-sky-500/40', card: 'from-sky-50 to-white dark:from-sky-500/10 dark:to-card border-sky-200/60 dark:border-sky-500/20', bar: '[&>div]:bg-sky-500' },
};

function StatCard({ icon: Icon, label, value, sub, progress, tone = 'violet', testId }: { icon: any; label: string; value: React.ReactNode; sub?: React.ReactNode; progress?: number; tone?: keyof typeof TONES; testId?: string }) {
  const t = TONES[tone] || TONES.violet;
  return (
    <Card data-testid={testId} className={cn('card-lift group relative overflow-hidden bg-gradient-to-br', t.card)}>
      <Icon className="pointer-events-none absolute -right-4 -bottom-4 h-24 w-24 opacity-[0.06] transition-transform duration-500 group-hover:scale-125 group-hover:-rotate-12" />
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-muted-foreground">{label}</p>
          <span className={cn('inline-flex h-9 w-9 items-center justify-center rounded-xl shadow-md transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6', t.chip)}><Icon className="h-4 w-4" /></span>
        </div>
        <p className="mt-2 text-3xl font-black tabular-nums tracking-tight">{value}</p>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
        {typeof progress === 'number' && <Progress value={progress} className={cn('mt-3 h-2', t.bar)} />}
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
      <div className="flex flex-col gap-1 pop-in">
        <p className="text-sm font-semibold text-muted-foreground">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight">
          <span className="mr-2 inline-block animate-float">{greeting().emoji}</span>
          {greeting().text}, <span className="text-gradient">{name}</span>.
        </h1>
        <p className="text-muted-foreground">Your Healthcare AI journey, one module at a time.</p>
      </div>

      {error && (
        <Card className="border-destructive/40"><CardContent className="p-5 text-sm">
          <p className="font-medium">Could not load your data</p>
          <p className="text-muted-foreground mt-1">Something went wrong. Please refresh and try again in a moment.</p>
        </CardContent></Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 pop-in">
        <StatCard icon={Zap} label={`Level ${xp.level.level}`} value={`${xp.level.xp} XP`} sub={`${xp.level.title} · ${xp.level.remaining} XP to level ${xp.level.level + 1}`} progress={Math.round(xp.level.progress * 100)} tone="violet" testId="stat-level" />
        <StatCard icon={Flame} label="Streak" value={`${streak.current} day${streak.current === 1 ? '' : 's'}`} sub={streak.activeToday ? 'Active today — keep it going!' : streak.current > 0 ? 'Log progress today to extend it' : `Longest: ${streak.longest} days`} tone="orange" testId="stat-streak" />
        <StatCard icon={CheckCircle2} label="Modules done" value={t ? `${t.modulesDone}/${t.modules}` : '—'} sub={t ? `${t.weightedPercent}% weighted progress · ${t.modulesInProgress} in progress` : 'No curriculum imported'} progress={t?.weightedPercent ?? 0} tone="emerald" testId="stat-modules" />
        <StatCard icon={Layers} label="Courses & phases" value={t ? `${t.unitsDone}/${t.units}` : '—'} sub={t ? `${t.phasesDone}/${t.phases} phases complete · ${t.phasesInProgress} active` : ''} progress={t && t.units ? Math.round((t.unitsDone / t.units) * 100) : 0} tone="sky" testId="stat-courses" />
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
          <Card className="lg:col-span-2 overflow-hidden card-lift relative" data-testid="continue-card">
            <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-fun" />
            <CardHeader className="pb-3 pt-7">
              <div className="flex items-center gap-2 text-primary"><Sparkles className="h-4 w-4 animate-float" /><span className="text-xs font-extrabold uppercase tracking-wider">Continue where you left off</span></div>
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
          <WeeklyQuests />
        </div>
      )}

      {!empty && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2"><MilestoneBadges tree={tree} /></div>
          <NearestAchievements />
        </div>
      )}

      {!empty && <ActivityHeatmap />}

      {!empty && tree && (
        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2"><GraduationCap className="h-4 w-4 text-primary" /> Phase overview</CardTitle>
            <Button asChild variant="ghost" size="sm"><Link href="/roadmap">Open roadmap <ArrowRight className="h-3.5 w-3.5 ml-1" /></Link></Button>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 pop-in">
            {tree.phases.map((p) => (
              <Link key={p.id} href={`/roadmap#phase-${p.key}`} className={cn('card-lift rounded-xl border bg-card p-3 hover:border-primary/40', p.status === 'completed' && 'bg-gradient-to-br from-emerald-50 to-card border-emerald-200/70 dark:from-emerald-500/10')} data-testid={`overview-${p.key}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">{p.phase_label || `Phase ${p.index}`}</p>
                  <span className={cn('text-xs font-bold tabular-nums rounded-full px-2 py-0.5', p.status === 'completed' ? 'bg-emerald-500 text-white' : p.percent > 0 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>{p.status === 'completed' ? '✓ 100%' : `${p.percent}%`}</span>
                </div>
                <p className="text-sm font-semibold leading-snug mt-1 line-clamp-2">{p.title}</p>
                <Progress value={p.percent} className="mt-2 h-2" />
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
