'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { toast } from 'sonner';
import { catchUp, finalize, liveState, pause as pauseSession, resume as resumeSession, skipBreak as skipBreakSession, startSession, type FocusSession, type PomodoroSettings, type TransitionEvent } from '@/lib/focus';
import { dayKey, formatMinutes } from '@/lib/week';
import { studyLogXp } from '@/lib/gamification';
import type { FocusController } from '@/components/lab/focus-screen';
import { useDemo } from '@/components/demo/demo-provider';
import { DEMO_FOCUS_STORAGE_KEY } from './storage-keys';

const sessionSchema = z.object({
  version: z.literal(1), id: z.string().min(1).max(100), startedAt: z.number().finite(),
  phase: z.enum(['focus', 'short_break', 'long_break']), running: z.boolean(), segStart: z.number().finite().nullable(),
  phaseAccumMs: z.number().finite().min(0), totalFocusMs: z.number().finite().min(0), completedFocus: z.number().int().min(0).max(10000),
  settings: z.object({ focusMinutes: z.number().min(1).max(180), shortBreakMinutes: z.number().min(1).max(60), longBreakMinutes: z.number().min(1).max(120), longBreakEvery: z.number().int().min(1).max(12) }),
  topic: z.string().max(200), moduleId: z.string().max(200).nullable(),
});

function loadSession(): FocusSession | null {
  try {
    const raw = localStorage.getItem(DEMO_FOCUS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = sessionSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) localStorage.removeItem(DEMO_FOCUS_STORAGE_KEY);
    return parsed.success ? parsed.data as FocusSession : null;
  } catch {
    try { localStorage.removeItem(DEMO_FOCUS_STORAGE_KEY); } catch {}
    return null;
  }
}

function saveSession(session: FocusSession | null) {
  try {
    if (session) localStorage.setItem(DEMO_FOCUS_STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(DEMO_FOCUS_STORAGE_KEY);
  } catch {}
}

const DemoFocusContext = createContext<FocusController | null>(null);

export function DemoFocusSessionProvider({ children }: { children: React.ReactNode }) {
  const { addLog } = useDemo();
  const [session, setSession] = useState<FocusSession | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [stopping, setStopping] = useState(false);
  const stoppingRef = useRef(false);
  const loaded = useRef(false);

  const commit = useCallback((next: FocusSession | null) => { setSession(next); saveSession(next); }, []);
  const announce = useCallback((events: TransitionEvent[]) => {
    for (const event of events) {
      if (event === 'focus_complete') toast.success('Focus interval complete', { description: 'Time for a break. Breaks are not counted as study time.' });
      else if (event === 'break_complete') toast('Break over', { description: 'Next focus interval started.' });
      else toast('Break over', { description: 'Your next focus interval is ready — press Resume when you are back.' });
    }
  }, []);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    const stored = loadSession();
    if (stored) {
      const caught = catchUp(stored, Date.now());
      commit(caught.session);
      announce(caught.events);
    }
  }, [announce, commit]);

  useEffect(() => {
    if (!session?.running) return;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      setSession((previous) => {
        if (!previous?.running) return previous;
        const caught = catchUp(previous, current);
        if (caught.events.length) { saveSession(caught.session); announce(caught.events); return caught.session; }
        return previous;
      });
    };
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [announce, session?.running]);

  const start = useCallback((settings: PomodoroSettings, topic: string, moduleId: string | null) => {
    if (session) return;
    const current = Date.now();
    setNow(current);
    commit(startSession(settings, topic, moduleId, current));
  }, [commit, session]);
  const pause = useCallback(() => setSession((previous) => {
    if (!previous) return previous;
    const current = Date.now(); setNow(current);
    const next = pauseSession(catchUp(previous, current).session, current); saveSession(next); return next;
  }), []);
  const resume = useCallback(() => setSession((previous) => {
    if (!previous) return previous;
    const current = Date.now(); setNow(current);
    const next = resumeSession(previous, current); saveSession(next); return next;
  }), []);
  const skipBreak = useCallback(() => setSession((previous) => {
    if (!previous) return previous;
    const current = Date.now(); setNow(current);
    const next = skipBreakSession(pauseSession(catchUp(previous, current).session, current), current); saveSession(next); return next;
  }), []);
  const stop = useCallback(async () => {
    if (!session || stoppingRef.current) return { minutes: 0, logged: false };
    stoppingRef.current = true; setStopping(true);
    try {
      const current = Date.now();
      const finished = finalize(session, current);
      commit(null);
      if (finished.minutes < 1) { toast('Session ended', { description: 'Less than a minute of focus time — nothing was logged.' }); return { minutes: 0, logged: false }; }
      addLog({ id: `demo-focus:${finished.session.id}`, loggedOn: dayKey(new Date(current)), minutes: finished.minutes, topic: finished.session.topic || null, notes: null, moduleId: finished.session.moduleId, createdAt: new Date(current).toISOString(), source: 'focus', sessionId: finished.session.id, focusIntervals: finished.session.completedFocus });
      toast.success(`Focus session saved: ${formatMinutes(finished.minutes)}`, { description: `+${studyLogXp(finished.minutes)} XP · stored only in this browser` });
      return { minutes: finished.minutes, logged: true };
    } finally {
      stoppingRef.current = false; setStopping(false);
    }
  }, [addLog, commit, session]);
  const live = useMemo(() => session ? liveState(session, now) : null, [now, session]);
  const value = useMemo<FocusController>(() => ({ session, live, start, pause, resume, skipBreak, stop, stopping }), [live, pause, resume, session, skipBreak, start, stop, stopping]);
  return <DemoFocusContext.Provider value={value}>{children}</DemoFocusContext.Provider>;
}

export function useDemoFocusSession(): FocusController {
  const value = useContext(DemoFocusContext);
  if (!value) throw new Error('useDemoFocusSession must be used within DemoFocusSessionProvider');
  return value;
}
