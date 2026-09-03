'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Check, Coffee, Loader2, Maximize2, Minimize2, Pause, Play, Settings2, SkipForward, Square, Timer, X } from 'lucide-react';
import { useFocusSession } from '@/lib/hooks/useFocusSession';
import { useOwnerSettings, useStudyLogs, useUpdatePomodoroSettings } from '@/lib/hooks/useStudyLogs';
import { useCurriculumTree } from '@/lib/hooks/useCurriculum';
import { clampSettings, fmtClock, PHASE_META, type PomodoroSettings } from '@/lib/focus';
import { formatMinutes } from '@/lib/week';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

function Ring({ progress, size = 280, stroke = 10, className }: { progress: number; size?: number; stroke?: number; className?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className={cn('-rotate-90', className)} aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="currentColor" strokeOpacity={0.15} strokeWidth={stroke} fill="none" />
      <circle cx={size / 2} cy={size / 2} r={r} stroke="currentColor" strokeWidth={stroke} fill="none" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, Math.max(0, progress)))} className="transition-[stroke-dashoffset] duration-700 ease-linear" />
    </svg>
  );
}

function SettingsEditor({ value, onSave, disabled }: { value: PomodoroSettings; onSave: (s: PomodoroSettings) => Promise<unknown>; disabled?: boolean }) {
  const [draft, setDraft] = useState<PomodoroSettings>(value);
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(value), [value]);
  const field = (k: keyof PomodoroSettings, label: string, min: number, max: number, testId: string) => (
    <div className="space-y-1">
      <Label htmlFor={`pom-${k}`} className="text-xs">{label}</Label>
      <Input id={`pom-${k}`} data-testid={testId} type="number" min={min} max={max} value={draft[k]} disabled={disabled}
        onChange={(e) => setDraft({ ...draft, [k]: Number(e.target.value) })} />
    </div>
  );
  return (
    <div className="space-y-3" data-testid="pomodoro-settings">
      <div className="grid grid-cols-2 gap-3">
        {field('focusMinutes', 'Focus (min)', 1, 180, 'pom-focus')}
        {field('shortBreakMinutes', 'Short break (min)', 1, 60, 'pom-short')}
        {field('longBreakMinutes', 'Long break (min)', 1, 120, 'pom-long')}
        {field('longBreakEvery', 'Long break every', 1, 12, 'pom-every')}
      </div>
      <Button size="sm" className="w-full" disabled={disabled || saving} data-testid="pom-save" onClick={async () => {
        setSaving(true);
        try { await onSave(clampSettings(draft)); toast.success('Pomodoro settings saved'); } catch (e: any) { toast.error('Could not save', { description: e.message }); } finally { setSaving(false); }
      }}>{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />} Save settings</Button>
      {disabled && <p className="text-[11px] text-muted-foreground">Settings apply to the next session.</p>}
    </div>
  );
}

export default function FocusPage() {
  const router = useRouter();
  const { session, live, start, pause, resume, skipBreak, stop, stopping } = useFocusSession();
  const { pomodoro, isLoading: settingsLoading } = useOwnerSettings();
  const updatePomodoro = useUpdatePomodoroSettings();
  const { tree } = useCurriculumTree();
  const { logs } = useStudyLogs();
  const target = tree?.continueTarget;

  const [topic, setTopic] = useState('');
  const [moduleId, setModuleId] = useState<string | null>(null);
  const [confirmStop, setConfirmStop] = useState(false);
  const [isFs, setIsFs] = useState(false);

  useEffect(() => {
    if (!topic && target) { setTopic(target.module.title); setModuleId(target.module.id); }
  }, [target, topic]);

  useEffect(() => {
    const onFs = () => setIsFs(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  // Keyboard: space toggles pause/resume while a session is active
  useEffect(() => {
    if (!session) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        session.running ? pause() : resume();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [session, pause, resume]);

  const recentFocus = useMemo(() => logs.filter((l) => l.source === 'focus').slice(0, 6), [logs]);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { /* unsupported */ }
  }

  async function onStop() {
    setConfirmStop(false);
    await stop();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }

  // ---------------- Active session: distraction-free overlay ----------------
  if (session && live) {
    const isFocus = session.phase === 'focus';
    const tone = !session.running ? 'text-slate-300' : isFocus ? 'text-orange-400' : 'text-sky-400';
    const every = session.settings.longBreakEvery;
    const inCycle = session.completedFocus % every;
    const dots = Array.from({ length: every }, (_, i) => i < inCycle || (isFocus && false));
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col" data-testid="focus-overlay">
        <div className="flex items-center justify-between p-4 md:p-6">
          <div className="flex items-center gap-2 text-sm text-slate-400"><Timer className="h-4 w-4" /> Focus Mode</div>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild><Button variant="ghost" size="icon" className="text-slate-300 hover:text-white hover:bg-white/10" title="Pomodoro settings" data-testid="focus-settings"><Settings2 className="h-4 w-4" /></Button></PopoverTrigger>
              <PopoverContent align="end" className="w-80"><SettingsEditor value={pomodoro} onSave={(s) => updatePomodoro.mutateAsync(s)} disabled /></PopoverContent>
            </Popover>
            <Button variant="ghost" size="icon" className="text-slate-300 hover:text-white hover:bg-white/10" onClick={toggleFullscreen} title="Toggle fullscreen" data-testid="focus-fullscreen">{isFs ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</Button>
            <Button variant="ghost" size="icon" className="text-slate-300 hover:text-white hover:bg-white/10" onClick={() => router.push('/')} title="Leave (session keeps running)" data-testid="focus-exit"><X className="h-4 w-4" /></Button>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 pb-10">
          <div className={cn('text-xs font-semibold uppercase tracking-[0.3em]', tone)} data-testid="focus-phase">
            {PHASE_META[session.phase].label}{!session.running && ' · paused'}
          </div>

          <div className={cn('relative', tone)}>
            <Ring progress={live.progress} size={288} />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
              <span className="text-6xl md:text-7xl font-bold tabular-nums tracking-tight" data-testid="focus-remaining">{fmtClock(live.remainingMs)}</span>
              <span className="text-xs text-slate-400 mt-1">remaining</span>
            </div>
          </div>

          <div className="flex items-center gap-2" aria-label="Completed intervals in this cycle" data-testid="focus-dots">
            {dots.map((filled, i) => <span key={i} className={cn('h-2.5 w-2.5 rounded-full', filled ? 'bg-orange-400' : 'bg-white/15')} />)}
            <span className="ml-2 text-xs text-slate-400">{inCycle}/{every} until long break · <span className="text-white" data-testid="focus-completed">{session.completedFocus}</span> completed</span>
          </div>

          <div className="text-center space-y-1">
            <p className="text-sm text-slate-300">Active study time <span className="font-semibold text-white tabular-nums" data-testid="focus-total">{fmtClock(live.totalFocusMs)}</span></p>
            {session.topic && <p className="text-xs text-slate-500 max-w-md truncate">{session.topic}</p>}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {session.running ? (
              <Button size="lg" className="rounded-full px-8 bg-white text-slate-900 hover:bg-slate-200" onClick={pause} data-testid="focus-pause"><Pause className="h-4 w-4 mr-2" /> Pause</Button>
            ) : (
              <Button size="lg" className="rounded-full px-8 bg-white text-slate-900 hover:bg-slate-200" onClick={resume} data-testid="focus-resume"><Play className="h-4 w-4 mr-2" /> Resume</Button>
            )}
            {!isFocus && <Button size="lg" variant="outline" className="rounded-full border-white/20 bg-transparent text-white hover:bg-white/10" onClick={skipBreak} data-testid="focus-skip-break"><SkipForward className="h-4 w-4 mr-2" /> Skip break</Button>}
            {!confirmStop ? (
              <Button size="lg" variant="outline" className="rounded-full border-white/20 bg-transparent text-white hover:bg-rose-500/20 hover:border-rose-400" onClick={() => setConfirmStop(true)} disabled={stopping} data-testid="focus-stop"><Square className="h-4 w-4 mr-2" /> Stop</Button>
            ) : (
              <div className="flex items-center gap-2 rounded-full border border-rose-400/50 bg-rose-500/10 px-3 py-1.5" data-testid="focus-stop-confirm">
                <span className="text-xs text-rose-200">Save {formatMinutes(Math.round(live.totalFocusMs / 60000))} and end?</span>
                <Button size="sm" className="rounded-full bg-rose-500 hover:bg-rose-500/90" onClick={onStop} disabled={stopping} data-testid="focus-stop-yes">{stopping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Stop & save'}</Button>
                <Button size="sm" variant="ghost" className="rounded-full text-white hover:bg-white/10" onClick={() => setConfirmStop(false)}>Cancel</Button>
              </div>
            )}
          </div>
          <p className="text-[11px] text-slate-500">Space = pause/resume · Breaks and pauses are never counted as study time · Session survives refresh</p>
        </div>
      </div>
    );
  }

  // ---------------- No session: start screen ----------------
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Focus Mode</h1>
        <p className="text-sm text-muted-foreground">Distraction-free Pomodoro timer. Study time is tracked automatically and saved when you stop.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3" data-testid="focus-start-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Timer className="h-4 w-4 text-primary" /> Start a session</CardTitle>
            <CardDescription>
              {pomodoro.focusMinutes} min focus · {pomodoro.shortBreakMinutes} min break · {pomodoro.longBreakMinutes} min long break every {pomodoro.longBreakEvery} intervals
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="focus-topic">What are you working on?</Label>
              <Input id="focus-topic" data-testid="focus-topic" value={topic} maxLength={200} placeholder="Topic or module" onChange={(e) => { setTopic(e.target.value); setModuleId(null); }} />
              {target && topic !== target.module.title && (
                <button type="button" data-testid="focus-use-current" onClick={() => { setTopic(target.module.title); setModuleId(target.module.id); }} className="text-xs text-primary hover:underline text-left">
                  Use current module: {target.module.title}
                </button>
              )}
            </div>
            <Button size="lg" className="w-full" data-testid="focus-start" disabled={settingsLoading} onClick={() => start(pomodoro, topic, moduleId)}>
              <Play className="h-4 w-4 mr-2" /> Start focus session
            </Button>
            <p className="text-xs text-muted-foreground">Only running focus intervals count. If you stop early, the focus time already accumulated is saved.</p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Settings2 className="h-4 w-4 text-primary" /> Pomodoro settings</CardTitle></CardHeader>
          <CardContent><SettingsEditor value={pomodoro} onSave={(s) => updatePomodoro.mutateAsync(s)} /></CardContent>
        </Card>
      </div>

      <Card data-testid="recent-focus">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Coffee className="h-4 w-4 text-primary" /> Recent focus sessions</CardTitle></CardHeader>
        <CardContent>
          {recentFocus.length === 0 ? (
            <p className="text-sm text-muted-foreground">No focus sessions yet. Your first one will appear here and count toward your streak and weekly goal.</p>
          ) : (
            <div className="space-y-1.5">
              {recentFocus.map((l) => (
                <div key={l.id} className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm">
                  <span className="inline-flex h-7 w-14 items-center justify-center rounded-md bg-primary/10 text-primary text-xs font-semibold">{formatMinutes(l.minutes)}</span>
                  <span className="flex-1 truncate">{l.topic || 'Focus session'}</span>
                  <span className="text-xs text-muted-foreground">{l.focus_intervals || 0} × ⏱ · {format(new Date(l.created_at), 'MMM d, HH:mm')}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
