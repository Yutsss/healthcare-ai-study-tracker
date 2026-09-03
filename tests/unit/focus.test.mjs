import { startSession, catchUp, pause, resume, finalize, liveState, skipBreak, DEFAULT_POMODORO } from './build/focus.js';
const MIN = 60_000; let pass = 0, fail = 0;
const eq = (name, got, exp) => { const ok = JSON.stringify(got) === JSON.stringify(exp); console.log(ok ? 'PASS' : 'FAIL', name, ok ? '' : `got=${JSON.stringify(got)} exp=${JSON.stringify(exp)}`); ok ? pass++ : fail++; };
const t0 = 1_000_000_000_000;
const S = { focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, longBreakEvery: 4 };

// 1. 10 min of focus, no transition
let s = startSession(S, 'topic', null, t0);
let l = liveState(s, t0 + 10 * MIN);
eq('10min focus live total', Math.round(l.totalFocusMs / MIN), 10);
eq('remaining 15min', Math.round(l.remainingMs / MIN), 15);

// 2. pause excludes paused time
s = pause(s, t0 + 10 * MIN);                 // 10 focus
s = resume(s, t0 + 40 * MIN);                // 30 min paused
l = liveState(s, t0 + 45 * MIN);             // +5 focus
eq('paused time excluded', Math.round(l.totalFocusMs / MIN), 15);

// 3. focus completes -> short break, break not counted
s = startSession(S, '', null, t0);
let r = catchUp(s, t0 + 27 * MIN);           // 25 focus + 2 into break
eq('phase after 27min', r.session.phase, 'short_break');
eq('completed intervals', r.session.completedFocus, 1);
eq('focus credited exactly 25', Math.round(r.session.totalFocusMs / MIN), 25);
eq('break elapsed 2min', Math.round(liveState(r.session, t0 + 27 * MIN).phaseMs / MIN), 2);
eq('total unchanged during break', Math.round(liveState(r.session, t0 + 29 * MIN).totalFocusMs / MIN), 25);

// 4. break ends while away -> next focus PAUSED (no phantom study time)
r = catchUp(s, t0 + 120 * MIN);              // away 2 hours
eq('after long absence: phase focus', r.session.phase, 'focus');
eq('after long absence: paused', r.session.running, false);
eq('after long absence: only 25 counted', Math.round(r.session.totalFocusMs / MIN), 25);
eq('events', r.events, ['focus_complete', 'break_complete_paused']);

// 5. break ends live (within grace) -> next focus auto-runs
r = catchUp(s, t0 + 30 * MIN + 2000);        // 25 + 5 break + 2s
eq('live transition: running', r.session.running, true);
eq('live transition: focus', r.session.phase, 'focus');

// 6. long break after 4 intervals (simulate live ticking every minute)
s = startSession(S, '', null, t0);
let now = t0;
for (let i = 0; i < 200; i++) { now += MIN; const c = catchUp(s, now); s = c.session; if (s.completedFocus === 4 && s.phase !== 'focus') break; }
eq('4th interval -> long break', s.phase, 'long_break');
eq('total after 4 intervals', Math.round(s.totalFocusMs / MIN), 100);

// 7. early stop saves accumulated focus
s = startSession(S, '', null, t0);
let f = finalize(s, t0 + 13 * MIN + 20_000);
eq('early stop minutes', f.minutes, 13);
f = finalize(startSession(S, '', null, t0), t0 + 20_000);
eq('<30s -> 0 min (nothing logged)', f.minutes, 0);
f = finalize(startSession(S, '', null, t0), t0 + 40_000);
eq('40s -> 1 min', f.minutes, 1);

// 8. finalize during a break only counts focus
s = catchUp(startSession(S, '', null, t0), t0 + 28 * MIN).session;
f = finalize(s, t0 + 28 * MIN);
eq('stop during break -> 25', f.minutes, 25);

// 9. skip break -> focus running
s = skipBreak(s, t0 + 28 * MIN);
eq('skip break -> focus running', [s.phase, s.running], ['focus', true]);

// 10. idempotent: finalize twice same result, and session id stable
const s2 = startSession(S, '', null, t0);
eq('same id', finalize(s2, t0 + 5 * MIN).session.id === finalize(s2, t0 + 5 * MIN).session.id, true);

console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
