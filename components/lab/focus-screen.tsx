'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Check, Coffee, Loader2, Maximize2, Minimize2, Pause, Play, Settings2, SkipForward, Square, Timer, X } from 'lucide-react';
import { clampSettings, fmtClock, PHASE_META, type FocusSession, type PomodoroSettings } from '@/lib/focus';
import type { CurriculumTree } from '@/lib/curriculum';
import type { LabRouteMap } from '@/lib/lab/routes';
import type { LabStudyLog } from '@/lib/lab/types';
import { formatMinutes } from '@/lib/week';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export type FocusController = {
  session: FocusSession | null;
  live: ReturnType<typeof import('@/lib/focus').liveState> | null;
  start(settings: PomodoroSettings, topic: string, moduleId: string | null): void;
  pause(): void;
  resume(): void;
  skipBreak(): void;
  stop(): Promise<{ minutes: number; logged: boolean }>;
  stopping: boolean;
};

export type FocusScreenProps = {
  mode: 'owner' | 'demo';
  routes: LabRouteMap;
  controller: FocusController;
  settings: PomodoroSettings;
  settingsLoading: boolean;
  tree: CurriculumTree | null;
  logs: LabStudyLog[];
  onSaveSettings(settings: PomodoroSettings): Promise<void>;
};

function Ring({ progress, size = 280, stroke = 10, className }: { progress: number; size?: number; stroke?: number; className?: string }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return <svg width={size} height={size} className={cn('-rotate-90', className)} aria-hidden><circle cx={size / 2} cy={size / 2} r={radius} stroke="currentColor" strokeOpacity={0.15} strokeWidth={stroke} fill="none" /><circle cx={size / 2} cy={size / 2} r={radius} stroke="currentColor" strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - Math.min(1, Math.max(0, progress)))} className="transition-[stroke-dashoffset] duration-700 ease-linear" /></svg>;
}

function SettingsEditor({ value, onSave, disabled }: { value: PomodoroSettings; onSave: (settings: PomodoroSettings) => Promise<void>; disabled?: boolean }) {
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(value), [value]);
  const field = (key: keyof PomodoroSettings, label: string, min: number, max: number, testId: string) => <div className="space-y-1"><Label htmlFor={`pom-${key}`} className="text-xs">{label}</Label><Input id={`pom-${key}`} data-testid={testId} type="number" min={min} max={max} value={draft[key]} disabled={disabled} onChange={(event) => setDraft({ ...draft, [key]: Number(event.target.value) })} /></div>;
  return <div className="space-y-3" data-testid="pomodoro-settings"><div className="grid grid-cols-2 gap-3">{field('focusMinutes', 'Focus (min)', 1, 180, 'pom-focus')}{field('shortBreakMinutes', 'Short break (min)', 1, 60, 'pom-short')}{field('longBreakMinutes', 'Long break (min)', 1, 120, 'pom-long')}{field('longBreakEvery', 'Long break every', 1, 12, 'pom-every')}</div><Button size="sm" className="w-full" disabled={disabled || saving} data-testid="pom-save" onClick={async () => { setSaving(true); try { await onSave(clampSettings(draft)); toast.success('Pomodoro settings saved'); } catch (cause: any) { toast.error('Could not save', { description: cause?.message }); } finally { setSaving(false); } }}>{saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />} Save settings</Button>{disabled && <p className="text-[11px] text-muted-foreground">Settings apply to the next session.</p>}</div>;
}

export function FocusScreen({ routes, controller, settings, settingsLoading, tree, logs, onSaveSettings }: FocusScreenProps) {
  const { session, live, start, pause, resume, skipBreak, stop, stopping } = controller;
  const target = tree?.continueTarget;
  const [topic, setTopic] = useState('');
  const [moduleId, setModuleId] = useState<string | null>(null);
  const [confirmStop, setConfirmStop] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => { if (!topic && target) { setTopic(target.module.title); setModuleId(target.module.id); } }, [target, topic]);
  useEffect(() => { const changed = () => setIsFullscreen(Boolean(document.fullscreenElement)); document.addEventListener('fullscreenchange', changed); return () => document.removeEventListener('fullscreenchange', changed); }, []);
  useEffect(() => {
    if (!session) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) { event.preventDefault(); session.running ? pause() : resume(); }
    };
    window.addEventListener('keydown', keydown); return () => window.removeEventListener('keydown', keydown);
  }, [pause, resume, session]);
  const recentFocus = useMemo(() => logs.filter((log) => log.source === 'focus').slice(0, 6), [logs]);
  async function toggleFullscreen() { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch {} }
  async function endSession() { setConfirmStop(false); await stop(); if (document.fullscreenElement) await document.exitFullscreen().catch(() => {}); }

  if (session && live) {
    const isFocus = session.phase === 'focus';
    const tone = !session.running ? 'text-slate-300' : isFocus ? 'text-orange-400' : 'text-sky-400';
    const every = session.settings.longBreakEvery;
    const completedInCycle = session.completedFocus % every;
    return <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white" data-testid="focus-overlay">
      <div className="flex items-center justify-between p-4 md:p-6"><div className="flex items-center gap-2 text-sm text-slate-400"><Timer className="h-4 w-4" /> Focus Mode</div><div className="flex items-center gap-2"><Popover><PopoverTrigger asChild><Button variant="ghost" size="icon" className="text-slate-300 hover:bg-white/10 hover:text-white" title="Pomodoro settings" data-testid="focus-settings"><Settings2 className="h-4 w-4" /></Button></PopoverTrigger><PopoverContent align="end" className="w-80"><SettingsEditor value={settings} onSave={onSaveSettings} disabled /></PopoverContent></Popover><Button variant="ghost" size="icon" className="text-slate-300 hover:bg-white/10 hover:text-white" onClick={toggleFullscreen} title="Toggle fullscreen" data-testid="focus-fullscreen">{isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</Button><Button asChild variant="ghost" size="icon" className="text-slate-300 hover:bg-white/10 hover:text-white" title="Leave (session keeps running)" data-testid="focus-exit"><Link href={routes.dashboard}><X className="h-4 w-4" /></Link></Button></div></div>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 pb-10"><div className={cn('text-xs font-semibold uppercase tracking-[0.3em]', tone)} data-testid="focus-phase">{PHASE_META[session.phase].label}{!session.running && ' · paused'}</div><div className={cn('relative', tone)}><Ring progress={live.progress} size={288} /><div className="absolute inset-0 flex flex-col items-center justify-center text-white"><span className="text-6xl font-bold tabular-nums tracking-tight md:text-7xl" data-testid="focus-remaining">{fmtClock(live.remainingMs)}</span><span className="mt-1 text-xs text-slate-400">remaining</span></div></div><div className="flex items-center gap-2" aria-label="Completed intervals in this cycle" data-testid="focus-dots">{Array.from({ length: every }, (_, index) => <span key={index} className={cn('h-2.5 w-2.5 rounded-full', index < completedInCycle ? 'bg-orange-400' : 'bg-white/15')} />)}<span className="ml-2 text-xs text-slate-400">{completedInCycle}/{every} until long break · <span className="text-white" data-testid="focus-completed">{session.completedFocus}</span> completed</span></div><div className="space-y-1 text-center"><p className="text-sm text-slate-300">Active study time <span className="font-semibold tabular-nums text-white" data-testid="focus-total">{fmtClock(live.totalFocusMs)}</span></p>{session.topic && <p className="max-w-md truncate text-xs text-slate-500">{session.topic}</p>}</div><div className="flex flex-wrap items-center justify-center gap-3 pt-2">{session.running ? <Button size="lg" className="rounded-full bg-white px-8 text-slate-900 hover:bg-slate-200" onClick={pause} data-testid="focus-pause"><Pause className="mr-2 h-4 w-4" /> Pause</Button> : <Button size="lg" className="rounded-full bg-white px-8 text-slate-900 hover:bg-slate-200" onClick={resume} data-testid="focus-resume"><Play className="mr-2 h-4 w-4" /> Resume</Button>}{!isFocus && <Button size="lg" variant="outline" className="rounded-full border-white/20 bg-transparent text-white hover:bg-white/10" onClick={skipBreak} data-testid="focus-skip-break"><SkipForward className="mr-2 h-4 w-4" /> Skip break</Button>}{!confirmStop ? <Button size="lg" variant="outline" className="rounded-full border-white/20 bg-transparent text-white hover:border-rose-400 hover:bg-rose-500/20" onClick={() => setConfirmStop(true)} disabled={stopping} data-testid="focus-stop"><Square className="mr-2 h-4 w-4" /> Stop</Button> : <div className="flex items-center gap-2 rounded-full border border-rose-400/50 bg-rose-500/10 px-3 py-1.5" data-testid="focus-stop-confirm"><span className="text-xs text-rose-200">Save {formatMinutes(Math.round(live.totalFocusMs / 60000))} and end?</span><Button size="sm" className="rounded-full bg-rose-500 hover:bg-rose-500/90" onClick={() => void endSession()} disabled={stopping} data-testid="focus-stop-yes">{stopping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Stop & save'}</Button><Button size="sm" variant="ghost" className="rounded-full text-white hover:bg-white/10" onClick={() => setConfirmStop(false)}>Cancel</Button></div>}</div><p className="text-[11px] text-slate-500">Space = pause/resume · Breaks and pauses are never counted as study time · Session survives refresh</p></div>
    </div>;
  }

  return <div className="max-w-4xl space-y-6"><div className="flex items-end justify-between gap-3"><div><h1 className="text-2xl font-bold tracking-tight">Focus Mode</h1><p className="text-sm text-muted-foreground">Distraction-free Pomodoro timer. Study time is tracked automatically and saved when you stop.</p></div><Button asChild variant="outline"><Link href={routes.log}>View study log</Link></Button></div><div className="grid gap-4 lg:grid-cols-5"><Card className="lg:col-span-3" data-testid="focus-start-card"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Timer className="h-4 w-4 text-primary" /> Start a session</CardTitle><CardDescription>{settings.focusMinutes} min focus · {settings.shortBreakMinutes} min break · {settings.longBreakMinutes} min long break every {settings.longBreakEvery} intervals</CardDescription></CardHeader><CardContent className="space-y-4"><div className="space-y-1.5"><Label htmlFor="focus-topic">What are you working on?</Label><Input id="focus-topic" data-testid="focus-topic" value={topic} maxLength={200} placeholder="Topic or module" onChange={(event) => { setTopic(event.target.value); setModuleId(null); }} />{target && topic !== target.module.title && <button type="button" data-testid="focus-use-current" onClick={() => { setTopic(target.module.title); setModuleId(target.module.id); }} className="text-left text-xs text-primary hover:underline">Use current module: {target.module.title}</button>}</div><Button size="lg" className="w-full" data-testid="focus-start" disabled={settingsLoading} onClick={() => start(settings, topic, moduleId)}><Play className="mr-2 h-4 w-4" /> Start focus session</Button><p className="text-xs text-muted-foreground">Only running focus intervals count. If you stop early, the focus time already accumulated is saved.</p></CardContent></Card><Card className="lg:col-span-2"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Settings2 className="h-4 w-4 text-primary" /> Pomodoro settings</CardTitle></CardHeader><CardContent><SettingsEditor value={settings} onSave={onSaveSettings} /></CardContent></Card></div><Card data-testid="recent-focus"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Coffee className="h-4 w-4 text-primary" /> Recent focus sessions</CardTitle></CardHeader><CardContent>{recentFocus.length === 0 ? <p className="text-sm text-muted-foreground">No focus sessions yet. Your first one will appear here and count toward your streak and weekly goal.</p> : <div className="space-y-1.5">{recentFocus.map((log) => <div key={log.id} className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm"><span className="inline-flex h-7 w-14 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">{formatMinutes(log.minutes)}</span><span className="flex-1 truncate">{log.topic || 'Focus session'}</span><span className="text-xs text-muted-foreground">{log.focus_intervals || 0} × ⏱ · {format(new Date(log.created_at), 'MMM d, HH:mm')}</span></div>)}</div>}</CardContent></Card></div>;
}
