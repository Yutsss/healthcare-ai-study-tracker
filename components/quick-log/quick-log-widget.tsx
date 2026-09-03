'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Pause, Play, Square, Timer, X } from 'lucide-react';
import { useAddStudyLog, useOwnerSettings, useStudyLogs, studyLogXp } from '@/lib/hooks/useStudyLogs';
import { useCurriculumTree } from '@/lib/hooks/useCurriculum';
import { dayKey, formatMinutes } from '@/lib/week';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

const TIMER_KEY = 'yl_quick_timer';
const CHIPS = [15, 25, 30, 45, 60];

type TimerState = { running: boolean; startedAt: number | null; accumulatedMs: number };
const EMPTY: TimerState = { running: false, startedAt: null, accumulatedMs: 0 };

function loadTimer(): TimerState {
  if (typeof window === 'undefined') return EMPTY;
  try { const raw = window.localStorage.getItem(TIMER_KEY); return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY; } catch { return EMPTY; }
}
function saveTimer(t: TimerState) { try { window.localStorage.setItem(TIMER_KEY, JSON.stringify(t)); } catch {} }
function elapsedMs(t: TimerState, now = Date.now()) { return t.accumulatedMs + (t.running && t.startedAt ? now - t.startedAt : 0); }
function fmtClock(ms: number) {
  const s = Math.floor(ms / 1000); const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const sec = s % 60;
  return (h ? `${h}:` : '') + `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function QuickLogWidget() {
  const [open, setOpen] = useState(false);
  const [timer, setTimer] = useState<TimerState>(EMPTY);
  const [now, setNow] = useState(Date.now());
  const [minutes, setMinutes] = useState('');
  const [topic, setTopic] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(() => dayKey(new Date()));
  const [moduleId, setModuleId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const add = useAddStudyLog();
  const { weekMinutes } = useStudyLogs();
  const { weeklyGoal } = useOwnerSettings();
  const { tree } = useCurriculumTree();
  const target = tree?.continueTarget;

  useEffect(() => { setTimer(loadTimer()); }, []);
  useEffect(() => {
    if (!timer.running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [timer.running]);

  const elapsed = elapsedMs(timer, now);
  const weekPct = Math.min(100, Math.round((weekMinutes / Math.max(1, weeklyGoal)) * 100));

  function update(t: TimerState) { setTimer(t); saveTimer(t); setNow(Date.now()); }
  function start() { update({ ...timer, running: true, startedAt: Date.now() }); }
  function pause() { update({ running: false, startedAt: null, accumulatedMs: elapsedMs(timer) }); }
  function stop() {
    const mins = Math.max(1, Math.round(elapsedMs(timer) / 60000));
    setMinutes(String(mins));
    update(EMPTY);
    setOpen(true);
  }
  function reset() { update(EMPTY); }

  const xpPreview = useMemo(() => { const m = Number(minutes); return Number.isFinite(m) && m > 0 ? studyLogXp(m) : 0; }, [minutes]);

  async function save() {
    setError('');
    const m = Number(minutes);
    if (!Number.isFinite(m) || m < 1) { setError('Enter the minutes you studied (or use the timer).'); return; }
    try {
      await add.mutateAsync({ minutes: m, topic, notes, loggedOn: date, moduleId });
      const newWeek = weekMinutes + Math.round(m);
      toast.success(`Logged ${formatMinutes(m)}`, { description: `+${studyLogXp(m)} XP · this week ${formatMinutes(newWeek)} / ${formatMinutes(weeklyGoal)}${newWeek >= weeklyGoal ? ' — weekly goal reached!' : ''}` });
      setMinutes(''); setTopic(''); setNotes(''); setModuleId(null); setDate(dayKey(new Date()));
      update(EMPTY);
      setOpen(false);
    } catch (e: any) { setError(e?.message || 'Could not save'); }
  }

  return (
    <div className="fixed bottom-5 right-5 z-40">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button size="lg" data-testid="quick-log-button" className={cn('rounded-full shadow-lg gap-2 pl-4 pr-5', timer.running && 'bg-orange-500 hover:bg-orange-500/90 text-white')}>
            <Timer className="h-4 w-4" />
            {timer.running || elapsed > 0 ? <span className="tabular-nums font-semibold">{fmtClock(elapsed)}</span> : 'Quick Log'}
          </Button>
        </PopoverTrigger>
        <PopoverContent side="top" align="end" className="w-[22rem] p-0" data-testid="quick-log-panel">
          <div className="p-4 border-b space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm flex items-center gap-2"><Timer className="h-4 w-4 text-primary" /> Quick Log</p>
              <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground" aria-label="Close"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">This week</span>
              <span className="font-medium" data-testid="week-progress-text">{formatMinutes(weekMinutes)} / {formatMinutes(weeklyGoal)}</span>
            </div>
            <Progress value={weekPct} className="h-1.5" />
          </div>

          <div className="p-4 space-y-4">
            <div className="rounded-lg border bg-muted/40 p-3 flex items-center gap-3">
              <span className={cn('text-2xl font-bold tabular-nums flex-1', timer.running ? 'text-orange-600' : '')} data-testid="timer-display">{fmtClock(elapsed)}</span>
              {!timer.running ? (
                <Button size="sm" variant="outline" onClick={start} data-testid="timer-start"><Play className="h-3.5 w-3.5 mr-1" /> {elapsed > 0 ? 'Resume' : 'Start'}</Button>
              ) : (
                <Button size="sm" variant="outline" onClick={pause} data-testid="timer-pause"><Pause className="h-3.5 w-3.5 mr-1" /> Pause</Button>
              )}
              {elapsed > 0 && <Button size="sm" onClick={stop} data-testid="timer-stop" title="Stop and fill minutes"><Square className="h-3.5 w-3.5 mr-1" /> Stop</Button>}
              {elapsed > 0 && !timer.running && <button type="button" onClick={reset} className="text-xs text-muted-foreground underline" data-testid="timer-reset">reset</button>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ql-minutes">Minutes</Label>
              <div className="flex flex-wrap items-center gap-1.5">
                <Input id="ql-minutes" data-testid="ql-minutes" type="number" min={1} max={1440} className="w-24" placeholder="e.g. 45" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
                {CHIPS.map((c) => (
                  <button key={c} type="button" data-testid={`ql-chip-${c}`} onClick={() => setMinutes(String(c))}
                    className={cn('rounded-full border px-2.5 py-1 text-xs', minutes === String(c) ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground hover:bg-muted')}>{c}</button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ql-topic">What did you work on?</Label>
              <Input id="ql-topic" data-testid="ql-topic" placeholder="Topic, course, or notes" value={topic} onChange={(e) => { setTopic(e.target.value); setModuleId(null); }} maxLength={200} />
              {target && topic !== target.module.title && (
                <button type="button" data-testid="ql-use-current" onClick={() => { setTopic(target.module.title); setModuleId(target.module.id); }}
                  className="text-xs text-primary hover:underline text-left">Use current module: {target.module.title}</button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ql-date">Date</Label>
                <Input id="ql-date" data-testid="ql-date" type="date" value={date} max={dayKey(new Date())} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ql-notes">Note <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input id="ql-notes" data-testid="ql-notes" placeholder="Short note" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
              </div>
            </div>

            {error && <p role="alert" className="text-xs text-destructive" data-testid="ql-error">{error}</p>}

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{xpPreview ? `+${xpPreview} XP` : 'Counts toward streak & weekly goal'}</span>
              <Button size="sm" onClick={save} disabled={add.isPending} data-testid="ql-save">
                {add.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />} Log session
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
