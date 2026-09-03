'use client';

/**
 * Celebration engine: confetti bursts + short synthesized chimes.
 * No audio assets needed — sounds are generated with the Web Audio API.
 * Respects the user's sound preference (localStorage) and reduced-motion settings.
 */

export type CelebrationKind = 'levelup' | 'quest' | 'achievement';

export const SOUND_PREF_KEY = 'yl-sound';
export const SOUND_PREF_EVENT = 'yl-sound-change';

export function soundEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(SOUND_PREF_KEY) !== '0';
}

export function setSoundEnabled(on: boolean) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SOUND_PREF_KEY, on ? '1' : '0');
  window.dispatchEvent(new Event(SOUND_PREF_EVENT));
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

let audioCtx: AudioContext | null = null;
function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  return audioCtx;
}

/** Play a note sequence: [frequencyHz, startOffsetSec, durationSec][] */
function playNotes(notes: Array<[number, number, number]>, type: OscillatorType = 'triangle', gain = 0.12) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const go = () => {
    const now = ctx.currentTime;
    for (const [freq, start, dur] of notes) {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now + start);
      env.gain.setValueAtTime(0.0001, now + start);
      env.gain.exponentialRampToValueAtTime(gain, now + start + 0.02);
      env.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      osc.connect(env).connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.05);
    }
  };
  if (ctx.state === 'suspended') ctx.resume().then(go).catch(() => {});
  else go();
}

export function playChime(kind: CelebrationKind) {
  if (!soundEnabled()) return;
  try {
    if (kind === 'levelup') {
      // Rising major arpeggio + sparkle: C5 E5 G5 C6, then E6
      playNotes([[523.25, 0, 0.35], [659.25, 0.12, 0.35], [783.99, 0.24, 0.4], [1046.5, 0.36, 0.6], [1318.5, 0.55, 0.5]], 'triangle', 0.14);
    } else if (kind === 'quest') {
      // Cheerful two-tone "ta-da": G5 -> C6
      playNotes([[783.99, 0, 0.18], [1046.5, 0.16, 0.5]], 'sine', 0.14);
    } else {
      // Achievement: quick sparkle
      playNotes([[880, 0, 0.15], [1108.7, 0.1, 0.15], [1318.5, 0.2, 0.4]], 'sine', 0.12);
    }
  } catch {
    /* audio is best-effort */
  }
}

export async function burstConfetti(kind: CelebrationKind) {
  if (typeof window === 'undefined' || prefersReducedMotion()) return;
  try {
    const confetti = (await import('canvas-confetti')).default;
    const colors = ['#14b8a6', '#8b5cf6', '#f97316', '#f43f5e', '#0ea5e9', '#facc15'];
    if (kind === 'levelup') {
      // Big double-sided burst plus a shower from the top.
      confetti({ particleCount: 90, spread: 70, origin: { x: 0.2, y: 0.7 }, colors, scalar: 1.1, zIndex: 9999 });
      confetti({ particleCount: 90, spread: 70, origin: { x: 0.8, y: 0.7 }, colors, scalar: 1.1, zIndex: 9999 });
      setTimeout(() => confetti({ particleCount: 140, spread: 120, startVelocity: 45, origin: { x: 0.5, y: 0.3 }, colors, shapes: ['star', 'circle', 'square'], zIndex: 9999 }), 250);
    } else if (kind === 'quest') {
      confetti({ particleCount: 110, spread: 90, startVelocity: 40, origin: { x: 0.5, y: 0.55 }, colors, zIndex: 9999 });
    } else {
      confetti({ particleCount: 60, spread: 60, origin: { x: 0.5, y: 0.6 }, colors, zIndex: 9999 });
    }
  } catch {
    /* confetti is best-effort */
  }
}

export function celebrate(kind: CelebrationKind) {
  void burstConfetti(kind);
  playChime(kind);
}
