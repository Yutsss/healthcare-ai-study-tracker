/**
 * Focus / Pomodoro session engine. Pure functions; time is always passed in (ms epoch)
 * so the engine is deterministic and testable. Only FOCUS phases while RUNNING count as
 * study time. Pauses and breaks never count.
 */
export type Phase = 'focus' | 'short_break' | 'long_break';

export type PomodoroSettings = {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  longBreakEvery: number;
};

export const DEFAULT_POMODORO: PomodoroSettings = { focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, longBreakEvery: 4 };

export type FocusSession = {
  version: 1;
  id: string;
  startedAt: number;
  phase: Phase;
  running: boolean;
  /** epoch ms when the current running segment started (null when paused) */
  segStart: number | null;
  /** committed ms in the current phase (excludes the live running segment) */
  phaseAccumMs: number;
  /** committed total focus ms across the whole session (excludes the live running segment) */
  totalFocusMs: number;
  completedFocus: number;
  settings: PomodoroSettings;
  topic: string;
  moduleId: string | null;
};

export type TransitionEvent = 'focus_complete' | 'break_complete' | 'break_complete_paused';

export const PHASE_META: Record<Phase, { label: string; short: string }> = {
  focus: { label: 'Focus', short: 'Focus' },
  short_break: { label: 'Short break', short: 'Break' },
  long_break: { label: 'Long break', short: 'Long break' },
};

export function clampSettings(s: Partial<PomodoroSettings> | null | undefined): PomodoroSettings {
  const c = (v: unknown, lo: number, hi: number, d: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
  };
  return {
    focusMinutes: c(s?.focusMinutes, 1, 180, DEFAULT_POMODORO.focusMinutes),
    shortBreakMinutes: c(s?.shortBreakMinutes, 1, 60, DEFAULT_POMODORO.shortBreakMinutes),
    longBreakMinutes: c(s?.longBreakMinutes, 1, 120, DEFAULT_POMODORO.longBreakMinutes),
    longBreakEvery: c(s?.longBreakEvery, 1, 12, DEFAULT_POMODORO.longBreakEvery),
  };
}

export function phaseTargetMs(s: FocusSession): number {
  const m = s.phase === 'focus' ? s.settings.focusMinutes : s.phase === 'short_break' ? s.settings.shortBreakMinutes : s.settings.longBreakMinutes;
  return m * 60_000;
}

export function newSessionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  // RFC4122-ish fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function startSession(settings: PomodoroSettings, topic: string, moduleId: string | null, now: number): FocusSession {
  return {
    version: 1,
    id: newSessionId(),
    startedAt: now,
    phase: 'focus',
    running: true,
    segStart: now,
    phaseAccumMs: 0,
    totalFocusMs: 0,
    completedFocus: 0,
    settings: clampSettings(settings),
    topic: topic.trim().slice(0, 200),
    moduleId,
  };
}

export function liveState(s: FocusSession, now: number) {
  const target = phaseTargetMs(s);
  const seg = s.running && s.segStart != null ? Math.max(0, now - s.segStart) : 0;
  const phaseMs = Math.min(target, s.phaseAccumMs + seg);
  const totalFocusMs = s.totalFocusMs + (s.running && s.phase === 'focus' ? Math.min(seg, Math.max(0, target - s.phaseAccumMs)) : 0);
  return {
    target,
    phaseMs,
    remainingMs: Math.max(0, target - phaseMs),
    progress: target ? phaseMs / target : 0,
    totalFocusMs,
  };
}

/** Commit the live running segment (used by pause/stop). Does not change phase. */
export function pause(s: FocusSession, now: number): FocusSession {
  if (!s.running || s.segStart == null) return { ...s, running: false, segStart: null };
  const target = phaseTargetMs(s);
  const seg = Math.max(0, now - s.segStart);
  const usable = Math.min(seg, Math.max(0, target - s.phaseAccumMs));
  return {
    ...s,
    running: false,
    segStart: null,
    phaseAccumMs: s.phaseAccumMs + usable,
    totalFocusMs: s.totalFocusMs + (s.phase === 'focus' ? usable : 0),
  };
}

export function resume(s: FocusSession, now: number): FocusSession {
  if (s.running) return s;
  return { ...s, running: true, segStart: now };
}

function nextBreak(s: FocusSession, completedFocus: number): Phase {
  return completedFocus % s.settings.longBreakEvery === 0 ? 'long_break' : 'short_break';
}

/**
 * Advance the session to `now`, applying every phase transition that should have
 * happened (handles background tabs, sleep, refresh). Focus time is credited only up to
 * each interval's target. When a BREAK ends while the user was away (> grace), the next
 * focus phase starts PAUSED so unattended time is never counted as study.
 */
export function catchUp(input: FocusSession, now: number, graceMs = 5_000): { session: FocusSession; events: TransitionEvent[] } {
  const events: TransitionEvent[] = [];
  let s = { ...input };
  let guard = 0;
  while (s.running && s.segStart != null && guard++ < 500) {
    const target = phaseTargetMs(s);
    const seg = Math.max(0, now - s.segStart);
    if (s.phaseAccumMs + seg < target) break;
    const needed = Math.max(0, target - s.phaseAccumMs);
    const transitionAt = s.segStart + needed;

    if (s.phase === 'focus') {
      const completedFocus = s.completedFocus + 1;
      s = {
        ...s,
        totalFocusMs: s.totalFocusMs + needed,
        completedFocus,
        phase: nextBreak(s, completedFocus),
        phaseAccumMs: 0,
        segStart: transitionAt,
        running: true,
      };
      events.push('focus_complete');
    } else {
      const stale = now - transitionAt > graceMs;
      s = { ...s, phase: 'focus', phaseAccumMs: 0, segStart: stale ? null : transitionAt, running: !stale };
      events.push(stale ? 'break_complete_paused' : 'break_complete');
      if (stale) break;
    }
  }
  return { session: s, events };
}

/** Skip the current break immediately and start the next focus interval running. */
export function skipBreak(s: FocusSession, now: number): FocusSession {
  if (s.phase === 'focus') return s;
  return { ...s, phase: 'focus', phaseAccumMs: 0, running: true, segStart: now };
}

/** Final accounting for Stop. Returns the committed session and the minutes to log. */
export function finalize(input: FocusSession, now: number): { session: FocusSession; minutes: number } {
  const s = pause(catchUp(input, now).session, now);
  let minutes = Math.round(s.totalFocusMs / 60_000);
  if (minutes < 1 && s.totalFocusMs >= 30_000) minutes = 1;
  return { session: s, minutes: Math.max(0, Math.min(1440, minutes)) };
}

export function fmtClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  return (h ? `${h}:` : '') + `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
