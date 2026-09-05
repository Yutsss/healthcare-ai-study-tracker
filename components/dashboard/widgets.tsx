'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { format, parseISO, subDays } from 'date-fns';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowRight, Award, CalendarDays, Flag, Target } from 'lucide-react';
import type { LabAchievementView, LabExerciseReport, LabMilestoneView, LabStudyLog } from '@/lib/lab/types';
import type { LabRouteMap } from '@/lib/lab/routes';
import { dayKey, formatMinutes, weekDayKeys } from '@/lib/week';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { AchievementIcon } from '@/components/achievement-icon';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// This week chart + weekly goal
// ---------------------------------------------------------------------------
export function WeekChart({ logs, reports, weeklyGoal }: { logs: LabStudyLog[]; reports: LabExerciseReport[]; weeklyGoal: number }) {
  const data = useMemo(() => {
    const keys = weekDayKeys();
    const today = dayKey(new Date());
    return keys.map((k) => {
      const logMin = logs.filter((l) => l.logged_on === k).reduce((s, l) => s + l.minutes, 0);
      const exMin = reports.filter((r) => dayKey(new Date(r.created_at)) === k).reduce((s, r) => s + (r.time_spent_minutes || 0), 0);
      return { day: format(parseISO(k), 'EEE'), key: k, logs: logMin, exercises: exMin, isToday: k === today };
    });
  }, [logs, reports]);

  const exerciseWeek = data.reduce((s, d) => s + d.exercises, 0);
  const weekMinutes = data.reduce((sum, day) => sum + day.logs, 0);
  const total = weekMinutes + exerciseWeek;
  const pct = Math.min(100, Math.round((total / Math.max(1, weeklyGoal)) * 100));

  return (
    <Card data-testid="week-chart">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /> This week</CardTitle>
            <CardDescription>Study sessions and exercise time, Monday to Sunday.</CardDescription>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold tabular-nums" data-testid="week-total">{formatMinutes(total)}</p>
            <p className="text-[11px] text-muted-foreground flex items-center justify-end gap-1"><Target className="h-3 w-3" /> goal {formatMinutes(weeklyGoal)} · {pct}%</p>
          </div>
        </div>
        <Progress value={pct} className={cn('h-2 mt-2', pct >= 100 && '[&>div]:bg-emerald-500')} />
      </CardHeader>
      <CardContent className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
            <YAxis tickLine={false} axisLine={false} fontSize={11} tickFormatter={(v) => `${v}m`} />
            <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v: number, name: string) => [formatMinutes(v), name === 'logs' ? 'Study logs' : 'Exercises']} />
            <Bar dataKey="logs" stackId="a" fill="hsl(var(--primary))" radius={[0, 0, 4, 4]} />
            <Bar dataKey="exercises" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Activity heatmap (last 16 weeks)
// ---------------------------------------------------------------------------
export function ActivityHeatmap({ activityDates, logs, streak, weeks = 16 }: {
  activityDates: string[];
  logs: LabStudyLog[];
  streak: { current: number; longest: number };
  weeks?: number;
}) {
  const { grid, months, max } = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of activityDates) { const k = dayKey(new Date(d)); counts.set(k, (counts.get(k) || 0) + 1); }
    for (const l of logs) counts.set(l.logged_on, (counts.get(l.logged_on) || 0) + 1);
    const today = new Date();
    // end on Sunday of the current week so columns are full weeks (Mon..Sun)
    const dow = (today.getDay() + 6) % 7; // Mon=0
    const end = new Date(today); end.setDate(today.getDate() + (6 - dow));
    const start = subDays(end, weeks * 7 - 1);
    const cols: Array<Array<{ key: string; count: number; future: boolean }>> = [];
    const months: Array<{ label: string; col: number }> = [];
    let cursor = new Date(start);
    let max = 0;
    for (let w = 0; w < weeks; w++) {
      const col = [];
      for (let d = 0; d < 7; d++) {
        const k = dayKey(cursor);
        const c = counts.get(k) || 0;
        max = Math.max(max, c);
        col.push({ key: k, count: c, future: cursor > today });
        if (cursor.getDate() === 1 || (w === 0 && d === 0)) months.push({ label: format(cursor, 'MMM'), col: w });
        cursor = new Date(cursor); cursor.setDate(cursor.getDate() + 1);
      }
      cols.push(col);
    }
    return { grid: cols, months: months.filter((m, i, a) => a.findIndex((x) => x.label === m.label) === i), max };
  }, [activityDates, logs, weeks]);

  const level = (c: number) => {
    if (c <= 0) return 'bg-muted';
    const r = c / Math.max(1, max);
    if (r <= 0.25) return 'bg-primary/30';
    if (r <= 0.5) return 'bg-primary/55';
    if (r <= 0.75) return 'bg-primary/80';
    return 'bg-primary';
  };

  return (
    <Card data-testid="activity-heatmap">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Activity</CardTitle>
          <p className="text-xs text-muted-foreground">Current streak <span className="font-semibold text-foreground">{streak.current}d</span> · longest <span className="font-semibold text-foreground">{streak.longest}d</span></p>
        </div>
        <CardDescription>Last {weeks} weeks — module progress, reports and study logs per day.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <div className="inline-flex flex-col gap-1 min-w-full">
          <div className="relative h-4 ml-8">
            {months.map((m) => (
              <span key={m.label + m.col} className="absolute text-[10px] text-muted-foreground" style={{ left: `${m.col * 16}px` }}>{m.label}</span>
            ))}
          </div>
          <div className="flex gap-1">
            <div className="flex flex-col gap-1 w-7 text-[10px] text-muted-foreground">
              {['Mon', '', 'Wed', '', 'Fri', '', 'Sun'].map((d, i) => <span key={i} className="h-3 leading-3">{d}</span>)}
            </div>
            {grid.map((col, ci) => (
              <div key={ci} className="flex flex-col gap-1">
                {col.map((cell) => (
                  <div key={cell.key} title={`${cell.key}: ${cell.count} activit${cell.count === 1 ? 'y' : 'ies'}`}
                    className={cn('h-3 w-3 rounded-[3px]', cell.future ? 'bg-transparent' : level(cell.count))} />
                ))}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1 ml-8 mt-1 text-[10px] text-muted-foreground">
            Less {['bg-muted', 'bg-primary/30', 'bg-primary/55', 'bg-primary/80', 'bg-primary'].map((c) => <span key={c} className={cn('h-3 w-3 rounded-[3px] inline-block', c)} />)} More
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Nearest achievements
// ---------------------------------------------------------------------------
export function NearestAchievements({ items, isLoading, routes }: {
  items: LabAchievementView[];
  isLoading: boolean;
  routes: LabRouteMap;
}) {
  const earnedCount = items.filter((item) => Boolean(item.earnedAt)).length;
  const nearest = items.filter((item) => !item.earnedAt && !item.complete)
    .sort((a, b) => b.ratio - a.ratio || a.target - b.target)
    .slice(0, 3);
  const total = items.length;
  return (
    <Card data-testid="nearest-achievements">
      <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2"><Award className="h-4 w-4 text-primary" /> Nearest achievements</CardTitle>
          <CardDescription>{earnedCount}/{total} unlocked</CardDescription>
        </div>
        <Button asChild variant="ghost" size="sm"><Link href={routes.progress}>All <ArrowRight className="h-3.5 w-3.5 ml-1" /></Link></Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && nearest.length === 0 && <p className="text-sm text-muted-foreground">Everything unlocked. Incredible.</p>}
        {nearest.map((a) => (
          <div key={a.def.key} className="flex items-start gap-3" data-testid={`nearest-${a.def.key}`}>
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><AchievementIcon name={a.def.icon} className="h-4 w-4" /></span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium truncate">{a.def.title}</p>
                <span className="text-[11px] text-muted-foreground tabular-nums">{a.current}/{a.target}</span>
              </div>
              <p className="text-xs text-muted-foreground truncate">{a.def.description} · +{a.def.xp_reward} XP</p>
              <Progress value={Math.round(a.ratio * 100)} className="h-1.5 mt-1.5" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Milestone badges
// ---------------------------------------------------------------------------
export function MilestoneBadges({ items, isLoading = false }: { items: LabMilestoneView[]; isLoading?: boolean }) {
  return (
    <Card data-testid="milestones" className="h-fit">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Flag className="h-4 w-4 text-primary" /> Journey milestones</CardTitle>
        <CardDescription>Each milestone lights up when all of its phases are complete.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((m) => (
            <div key={m.id} data-testid={`milestone-${m.key}`}
              className={cn('relative rounded-xl border p-4 transition-colors', m.complete ? 'border-emerald-300 bg-gradient-to-br from-emerald-50 to-emerald-100/60 shadow-[0_0_0_3px_rgba(16,185,129,0.15)] dark:border-emerald-500/30 dark:from-emerald-500/15 dark:to-card' : 'bg-card')}>
              <div className="flex items-center gap-3">
                <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold',
                  m.complete ? 'border-emerald-500 bg-emerald-500 text-white' : m.percent > 0 ? 'border-primary text-primary' : 'border-muted-foreground/30 text-muted-foreground')}>
                  {m.complete ? <Award className="h-5 w-5" /> : m.index}
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Milestone {m.index}</p>
              </div>
              <p className={cn('mt-3 text-sm font-semibold leading-snug', m.complete && 'text-emerald-800 dark:text-emerald-300')}>{m.title}</p>
              <Progress value={m.percent} className={cn('h-1.5 mt-3', m.complete && '[&>div]:bg-emerald-500')} />
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{m.phasesDone}/{m.phases.length} phases</span>
                <span className={cn('font-semibold', m.complete ? 'text-emerald-700' : 'text-foreground')}>{m.complete ? 'Achieved' : `${m.percent}%`}</span>
              </div>
              {m.description && <p className="mt-2 text-[11px] text-muted-foreground line-clamp-2" title={m.description}>{m.description}</p>}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
