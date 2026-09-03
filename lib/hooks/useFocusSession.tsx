'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/browser';
import {
  catchUp, finalize, liveState, pause as pauseFn, resume as resumeFn, skipBreak as skipFn, startSession,
  type FocusSession, type PomodoroSettings, type TransitionEvent,
} from '@/lib/focus';
import { dayKey, formatMinutes } from '@/lib/week';
import { STUDY_LOGS_KEY, studyLogXp } from '@/lib/hooks/useStudyLogs';

const SESSION_KEY = 'yl_focus_session_v1';
const PENDING_KEY = 'yl_focus_pending_v1';

type PendingLog = { sessionId: string; minutes: number; topic: string; moduleId: string | null; loggedOn: string; focusIntervals: number };

function load<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try { const raw = window.localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : null; } catch { return null; }
}
function save(key: string, value: unknown) {
  try { if (value == null) window.localStorage.removeItem(key); else window.localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

async function persistStudyLog(p: PendingLog): Promise<'saved' | 'duplicate'> {
  const supabase = createClient();
  const { data: sess } = await supabase.auth.getSession();
  const owner_id = sess?.session?.user?.id;
  if (!owner_id) throw new Error('Not signed in');
  const { error } = await supabase.from('study_logs').insert({
    owner_id,
    minutes: p.minutes,
    logged_on: p.loggedOn,
    topic: p.topic || null,
    module_id: p.moduleId,
    source: 'focus',
    session_id: p.sessionId,
    focus_intervals: p.focusIntervals,
  });
  if (error) {
    if (error.code === '23505') return 'duplicate'; // unique(owner_id, session_id) -> already logged
    throw new Error(error.message);
  }
  return 'saved';
}

type Ctx = {
  session: FocusSession | null;
  now: number;
  live: ReturnType<typeof liveState> | null;
  start: (settings: PomodoroSettings, topic: string, moduleId: string | null) => void;
  pause: () => void;
  resume: () => void;
  skipBreak: () => void;
  stop: () => Promise<{ minutes: number; logged: boolean }>;
  stopping: boolean;
};

const FocusCtx = createContext<Ctx | null>(null);

export function FocusSessionProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const [session, setSession] = useState<FocusSession | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [stopping, setStopping] = useState(false);
  const stoppingRef = useRef(false);
  const loaded = useRef(false);

  const commit = useCallback((s: FocusSession | null) => {
    setSession(s);
    save(SESSION_KEY, s);
  }, []);

  const announce = useCallback((events: TransitionEvent[]) => {
    for (const e of events) {
      if (e === 'focus_complete') toast.success('Focus interval complete', { description: 'Time for a break. Breaks are not counted as study time.' });
      else if (e === 'break_complete') toast('Break over', { description: 'Next focus interval started.' });
      else if (e === 'break_complete_paused') toast('Break over', { description: 'Your next focus interval is ready — press Resume when you are back.' });
    }
  }, []);

  const flushPending = useCallback(async () => {
    const pending = load<PendingLog[]>(PENDING_KEY) || [];
    if (!pending.length) return;
    const remaining: PendingLog[] = [];
    for (const p of pending) {
      try {
        await persistStudyLog(p);
      } catch {
        remaining.push(p);
      }
    }
    save(PENDING_KEY, remaining.length ? remaining : null);
    if (remaining.length !== pending.length) {
      qc.invalidateQueries({ queryKey: STUDY_LOGS_KEY });
      qc.invalidateQueries({ queryKey: ['xp'] });
      qc.invalidateQueries({ queryKey: ['activity'] });
    }
  }, [qc]);

  // Restore on mount (refresh / reopen), applying any transitions that happened meanwhile.
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    const stored = load<FocusSession>(SESSION_KEY);
    if (stored && stored.version === 1) {
      const { session: s, events } = catchUp(stored, Date.now());
      commit(s);
      if (events.length) announce(events);
    }
    flushPending();
    const onOnline = () => flushPending();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [commit, announce, flushPending]);

  // Tick while running; re-sync when the tab becomes visible again.
  useEffect(() => {
    if (!session?.running) return;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      setSession((prev) => {
        if (!prev || !prev.running) return prev;
        const { session: next, events } = catchUp(prev, t);
        if (events.length) { save(SESSION_KEY, next); setTimeout(() => announce(events), 0); return next; }
        return prev;
      });
    };
    const id = setInterval(tick, 1000);
    const onVis = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, [session?.running, announce]);

  // Cross-tab sync: another tab changed the session.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== SESSION_KEY) return;
      const s = load<FocusSession>(SESSION_KEY);
      setSession(s && s.version === 1 ? catchUp(s, Date.now()).session : null);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Live title while running
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!session) { if (document.title.startsWith('⏱')) document.title = "Yuta's Lab — Healthcare AI Journey"; return; }
    const l = liveState(session, now);
    const mm = Math.floor(l.remainingMs / 60000), ss = Math.floor((l.remainingMs % 60000) / 1000);
    document.title = `⏱ ${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')} · ${session.phase === 'focus' ? 'Focus' : 'Break'}${session.running ? '' : ' (paused)'}`;
  }, [session, now]);

  const start = useCallback((settings: PomodoroSettings, topic: string, moduleId: string | null) => {
    if (session) return; // one session at a time
    stoppingRef.current = false;
    const t = Date.now();
    setNow(t);
    commit(startSession(settings, topic, moduleId, t));
  }, [session, commit]);

  const pause = useCallback(() => {
    setSession((prev) => { if (!prev) return prev; const t = Date.now(); setNow(t); const s = pauseFn(catchUp(prev, t).session, t); save(SESSION_KEY, s); return s; });
  }, []);

  const resume = useCallback(() => {
    setSession((prev) => { if (!prev) return prev; const t = Date.now(); setNow(t); const s = resumeFn(prev, t); save(SESSION_KEY, s); return s; });
  }, []);

  const skipBreak = useCallback(() => {
    setSession((prev) => { if (!prev) return prev; const t = Date.now(); setNow(t); const s = skipFn(pauseFn(catchUp(prev, t).session, t), t); save(SESSION_KEY, s); return s; });
  }, []);

  const stop = useCallback(async (): Promise<{ minutes: number; logged: boolean }> => {
    if (!session || stoppingRef.current) return { minutes: 0, logged: false };
    stoppingRef.current = true;
    setStopping(true);
    try {
      const t = Date.now();
      const { session: fin, minutes } = finalize(session, t);
      // Clear the active session FIRST so refresh / double-click / another tab cannot log it twice.
      commit(null);
      if (minutes < 1) {
        toast('Session ended', { description: 'Less than a minute of focus time — nothing was logged.' });
        return { minutes: 0, logged: false };
      }
      const pending: PendingLog = { sessionId: fin.id, minutes, topic: fin.topic, moduleId: fin.moduleId, loggedOn: dayKey(new Date(t)), focusIntervals: fin.completedFocus };
      // Park it as pending until the DB confirms, so a network failure never loses the session.
      const list = load<PendingLog[]>(PENDING_KEY) || [];
      save(PENDING_KEY, [...list, pending]);
      try {
        const result = await persistStudyLog(pending);
        save(PENDING_KEY, (load<PendingLog[]>(PENDING_KEY) || []).filter((p) => p.sessionId !== pending.sessionId) || null);
        qc.invalidateQueries({ queryKey: STUDY_LOGS_KEY });
        qc.invalidateQueries({ queryKey: ['xp'] });
        qc.invalidateQueries({ queryKey: ['activity'] });
        if (result === 'saved') {
          toast.success(`Focus session saved: ${formatMinutes(minutes)}`, { description: `+${studyLogXp(minutes)} XP · ${fin.completedFocus} interval${fin.completedFocus === 1 ? '' : 's'} completed` });
        } else {
          toast('Session already saved', { description: 'This focus session was logged earlier.' });
        }
        return { minutes, logged: result === 'saved' };
      } catch (e: any) {
        toast.error('Saved locally — will sync when back online', { description: e?.message });
        return { minutes, logged: false };
      }
    } finally {
      stoppingRef.current = false;
      setStopping(false);
    }
  }, [session, commit, qc]);

  const live = useMemo(() => (session ? liveState(session, now) : null), [session, now]);

  const value = useMemo<Ctx>(() => ({ session, now, live, start, pause, resume, skipBreak, stop, stopping }), [session, now, live, start, pause, resume, skipBreak, stop, stopping]);
  return <FocusCtx.Provider value={value}>{children}</FocusCtx.Provider>;
}

export function useFocusSession(): Ctx {
  const ctx = useContext(FocusCtx);
  if (!ctx) throw new Error('useFocusSession must be used within FocusSessionProvider');
  return ctx;
}
