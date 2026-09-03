import { addDays, format, startOfWeek } from 'date-fns';

export const WEEK_STARTS_ON = 1; // Monday

export function weekStart(d: Date = new Date()): Date {
  return startOfWeek(d, { weekStartsOn: WEEK_STARTS_ON });
}

export function dayKey(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

/** Mon..Sun day keys for the week containing `d`. */
export function weekDayKeys(d: Date = new Date()): string[] {
  const start = weekStart(d);
  return Array.from({ length: 7 }, (_, i) => dayKey(addDays(start, i)));
}

export function formatMinutes(mins: number): string {
  const m = Math.max(0, Math.round(mins));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}
