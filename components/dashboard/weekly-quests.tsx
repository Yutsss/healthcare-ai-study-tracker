'use client';

import { CheckCircle2, Swords } from 'lucide-react';
import { format, addDays, parseISO } from 'date-fns';
import { useWeeklyQuests } from '@/lib/hooks/useWeeklyQuests';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export function WeeklyQuests() {
  const { quests, completed, isLoading, weekStart } = useWeeklyQuests();
  const resets = format(addDays(parseISO(weekStart), 7), 'EEE, MMM d');
  return (
    <Card data-testid="weekly-quests">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><Swords className="h-4 w-4 text-primary" /> Weekly quests</CardTitle>
          <span className="text-xs text-muted-foreground">{completed}/{quests.length} done</span>
        </div>
        <CardDescription>Three fresh quests every Monday. Resets {resets}.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {quests.map((q) => (
          <div key={q.id} className="flex items-start gap-3" data-testid={`quest-${q.key}`}>
            <span className={cn('mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', q.completed_at ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground')}>
              {q.completed_at ? <CheckCircle2 className="h-4 w-4" /> : <Swords className="h-4 w-4" />}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className={cn('text-sm font-medium truncate', q.completed_at && 'text-emerald-700')}>{q.title}</p>
                <span className="text-[11px] text-muted-foreground tabular-nums">{Math.min(q.current, q.target)}/{q.target}</span>
              </div>
              <p className="text-xs text-muted-foreground truncate">{q.description} · +{q.xp_reward} XP</p>
              <Progress value={Math.round(q.ratio * 100)} className={cn('h-1.5 mt-1.5', q.completed_at && '[&>div]:bg-emerald-500')} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
