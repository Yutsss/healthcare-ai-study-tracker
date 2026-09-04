'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { Award, Brain, Lock, Sparkles, TrendingUp, Trophy, Zap } from 'lucide-react';
import { useAchievements } from '@/lib/hooks/useAchievements';
import { useExerciseReports } from '@/lib/hooks/useExerciseReports';
import { useCurriculumTree } from '@/lib/hooks/useCurriculum';
import { useXp } from '@/lib/hooks/useGamification';
import { dayKey } from '@/lib/week';
import { AchievementIcon } from '@/components/achievement-icon';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { SkillTree } from '@/components/progress/skill-tree';
import { WeeklyQuests } from '@/components/dashboard/weekly-quests';
import { achievementTone } from '@/lib/fun-roadmap';

function ConfidenceTrends() {
  const { reports, isLoading } = useExerciseReports();
  const { tree } = useCurriculumTree();
  const [unitId, setUnitId] = useState<string>('');

  const moduleIndex = useMemo(() => {
    const map = new Map<string, { moduleTitle: string; unitId: string; unitTitle: string; phaseLabel: string | null }>();
    for (const p of tree?.phases || []) for (const u of p.units) for (const m of u.modules) map.set(m.id, { moduleTitle: m.title, unitId: u.id, unitTitle: u.title, phaseLabel: p.phase_label });
    return map;
  }, [tree]);

  const units = useMemo(() => {
    const counts = new Map<string, { id: string; title: string; phaseLabel: string | null; count: number }>();
    for (const r of reports) {
      const mi = moduleIndex.get(r.module_id);
      if (!mi) continue;
      const e = counts.get(mi.unitId) || { id: mi.unitId, title: mi.unitTitle, phaseLabel: mi.phaseLabel, count: 0 };
      e.count++;
      counts.set(mi.unitId, e);
    }
    return Array.from(counts.values()).sort((a, b) => b.count - a.count);
  }, [reports, moduleIndex]);

  const selected = unitId || units[0]?.id || '';

  const series = useMemo(() => {
    return reports
      .filter((r) => moduleIndex.get(r.module_id)?.unitId === selected)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((r, i) => ({
        idx: i + 1,
        date: format(new Date(r.created_at), 'MMM d'),
        confidence: r.confidence,
        difficulty: r.difficulty,
        module: moduleIndex.get(r.module_id)?.moduleTitle,
        activity: r.activity_title,
      }));
  }, [reports, moduleIndex, selected]);

  const avg = (k: 'confidence' | 'difficulty') => series.length ? (series.reduce((s, r) => s + (r[k] || 0), 0) / series.length).toFixed(1) : '–';
  const trend = series.length >= 2 ? (series[series.length - 1].confidence || 0) - (series[0].confidence || 0) : 0;

  return (
    <Card data-testid="confidence-trends" className="card-lift relative overflow-hidden border-sky-200/70 bg-gradient-to-br from-sky-50 via-white to-cyan-50/40 dark:border-sky-500/25 dark:from-sky-500/15 dark:via-card dark:to-card">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-400 via-cyan-400 to-teal-400" />
      <Brain className="pointer-events-none absolute -bottom-7 -right-5 h-28 w-28 text-sky-500 opacity-[0.06]" />
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500 text-white shadow-md shadow-sky-500/25"><Brain className="h-4 w-4" /></span> Confidence trends</CardTitle>
            <CardDescription>How your confidence and perceived difficulty evolve across exercise reports, per course.</CardDescription>
          </div>
          {units.length > 0 && (
            <Select value={selected} onValueChange={setUnitId}>
              <SelectTrigger className="sm:w-80" data-testid="trend-course-select"><SelectValue placeholder="Choose a course" /></SelectTrigger>
              <SelectContent>
                {units.map((u) => <SelectItem key={u.id} value={u.id}>{u.title} <span className="text-muted-foreground">({u.count})</span></SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && units.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center">No exercise reports yet. Log one from the Roadmap (clipboard icon on a module) and your trends will appear here.</p>
        )}
        {series.length > 0 && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">Avg confidence {avg('confidence')}/5</Badge>
              <Badge variant="outline">Avg difficulty {avg('difficulty')}/5</Badge>
              <Badge variant="outline">{series.length} report{series.length === 1 ? '' : 's'}</Badge>
              {series.length >= 2 && (
                <Badge className={cn(trend >= 0 ? 'bg-emerald-600 hover:bg-emerald-600' : 'bg-rose-600 hover:bg-rose-600')}>
                  <TrendingUp className="h-3 w-3 mr-1" /> confidence {trend >= 0 ? '+' : ''}{trend} since first report
                </Badge>
              )}
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 8, right: 12, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={12} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tickLine={false} axisLine={false} fontSize={11} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip contentStyle={{ borderRadius: 12, borderColor: 'hsl(var(--border))', backgroundColor: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))', fontSize: 12 }} labelFormatter={(_, payload: any) => { const p = payload?.[0]?.payload; return p ? `${p.date} · ${p.activity || p.module}` : ''; }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="confidence" name="Confidence" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="difficulty" name="Difficulty" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function XpHistory() {
  const { events, total, level } = useXp();
  const data = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const e of events) { const k = dayKey(new Date(e.created_at)); byDay.set(k, (byDay.get(k) || 0) + e.amount); }
    const days = Array.from(byDay.keys()).sort();
    if (days.length === 0) return [];
    const start = new Date(days[0] + 'T00:00:00');
    const today = new Date();
    const out: Array<{ date: string; xp: number; gained: number }> = [];
    let cum = 0;
    for (const d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
      const k = dayKey(d);
      const g = byDay.get(k) || 0;
      cum += g;
      out.push({ date: format(d, 'MMM d'), xp: cum, gained: g });
    }
    return out.slice(-60);
  }, [events]);

  return (
    <Card data-testid="xp-history" className="card-lift relative overflow-hidden border-violet-200/70 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50/40 dark:border-violet-500/25 dark:from-violet-500/15 dark:via-card dark:to-card">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400" />
      <Zap className="pointer-events-none absolute -bottom-7 -right-5 h-28 w-28 text-violet-500 opacity-[0.06]" />
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500 text-white shadow-md shadow-violet-500/25"><Zap className="h-4 w-4" /></span> XP over time</CardTitle>
        <CardDescription>{total} XP total · Level {level.level} ({level.title}) · {level.remaining} XP to next level</CardDescription>
      </CardHeader>
      <CardContent className="h-52">
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No XP yet — complete a module or log a session.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="xpFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
              <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={11} minTickGap={24} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tickLine={false} axisLine={false} fontSize={11} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip contentStyle={{ borderRadius: 12, borderColor: 'hsl(var(--border))', backgroundColor: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))', fontSize: 12 }} formatter={(v: number, n: string) => [v, n === 'xp' ? 'Total XP' : 'Gained']} />
              <Area type="monotone" dataKey="xp" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#xpFill)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

export default function ProgressPage() {
  const { items, earnedCount, total, isLoading } = useAchievements();
  const { tree } = useCurriculumTree();
  const earned = items.filter((a) => a.earnedAt).sort((a, b) => (b.earnedAt || '').localeCompare(a.earnedAt || ''));
  const locked = items.filter((a) => !a.earnedAt).sort((a, b) => b.ratio - a.ratio);

  return (
    <div className="space-y-6">
      <Card className="pop-in card-lift relative overflow-hidden border-amber-200/70 bg-gradient-to-br from-amber-50 via-white to-rose-50 dark:border-amber-500/25 dark:from-amber-500/15 dark:via-card dark:to-rose-500/10">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-amber-400 via-rose-400 to-violet-500" />
        <Trophy aria-hidden="true" className="pointer-events-none absolute right-80 top-1/2 z-0 hidden h-32 w-32 -translate-y-1/2 rotate-12 text-amber-500 opacity-[0.04] xl:block" />
        <CardContent className="relative z-10 flex flex-col gap-5 p-6 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-lg shadow-amber-500/30"><Trophy className="h-6 w-6" /></span>
            <div>
              <div className="mb-1 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300"><Sparkles className="h-3.5 w-3.5" /> See how far you&apos;ve come</div>
              <h1 className="text-3xl font-black tracking-tight md:text-4xl"><span className="text-gradient">Progress</span></h1>
              <p className="mt-1 text-sm text-muted-foreground">Achievements, XP and how your confidence grows over time.</p>
            </div>
          </div>
          <div className="relative z-20 rounded-2xl border border-white/70 bg-background/90 px-5 py-3 text-center shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-background/80">
            <p className="text-3xl font-black tabular-nums text-amber-700 dark:text-amber-300">{earnedCount}<span className="text-lg text-muted-foreground">/{total}</span></p>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Badges unlocked</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid items-start gap-4 lg:grid-cols-3 pop-in">
        <div className="lg:col-span-2"><SkillTree tree={tree} /></div>
        <WeeklyQuests className="border-rose-200/70 bg-gradient-to-br from-rose-50 via-white to-orange-50/40 dark:border-rose-500/25 dark:from-rose-500/15 dark:via-card dark:to-card" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 pop-in">
        <XpHistory />
        <ConfidenceTrends />
      </div>

      <Card data-testid="achievements" className="card-lift pop-in relative overflow-hidden border-amber-200/70 bg-gradient-to-br from-amber-50/70 via-card to-rose-50/60 dark:border-amber-500/25 dark:from-amber-500/10 dark:via-card dark:to-rose-500/10">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 via-rose-400 to-violet-400" />
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500 text-white shadow-md shadow-amber-500/25"><Award className="h-4 w-4" /></span> Achievements</CardTitle>
          <CardDescription>{earnedCount}/{total} unlocked</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {earned.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {earned.map((a, index) => {
                const tone = achievementTone(index, true);
                return <div key={a.def.key} data-testid={`achievement-${a.def.key}`} className={cn('card-lift rounded-xl border p-4 flex gap-3', tone.surface)}>
                  <span className={cn('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-md', tone.icon)}><AchievementIcon name={a.def.icon} className="h-5 w-5" /></span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{a.def.title}</p>
                    <p className="text-xs text-muted-foreground">{a.def.description}</p>
                    <p className={cn('text-[11px] mt-1', tone.text)}>Unlocked {format(new Date(a.earnedAt!), 'MMM d, yyyy')} · +{a.def.xp_reward} XP</p>
                  </div>
                </div>;
              })}
            </div>
          )}
          {locked.length > 0 && (
            <div className="space-y-2">
              {earned.length > 0 && <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Locked</p>}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {locked.map((a, index) => {
                  const tone = achievementTone(index, false);
                  return <div key={a.def.key} data-testid={`achievement-${a.def.key}`} className={cn('card-lift rounded-xl border p-4 flex gap-3', tone.surface)}>
                    <span className={cn('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border', a.ratio > 0 ? tone.soft : 'border-border bg-muted/70 text-muted-foreground')}>{a.ratio > 0 ? <AchievementIcon name={a.def.icon} className="h-5 w-5" /> : <Lock className="h-4 w-4" />}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold truncate">{a.def.title}</p>
                        <span className="text-[11px] text-muted-foreground tabular-nums">{a.current}/{a.target}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{a.def.description} · +{a.def.xp_reward} XP</p>
                      <Progress value={Math.round(a.ratio * 100)} className={cn('h-1.5 mt-2', tone.progress)} />
                    </div>
                  </div>;
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
