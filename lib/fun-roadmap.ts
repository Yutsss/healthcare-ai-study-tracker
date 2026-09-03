export type FunToneName = 'emerald' | 'violet' | 'sky' | 'amber' | 'rose' | 'teal';

export type FunTone = {
  name: FunToneName;
  surface: string;
  icon: string;
  soft: string;
  text: string;
  progress: string;
  accent: string;
};

const TONES: Record<FunToneName, FunTone> = {
  emerald: {
    name: 'emerald',
    surface: 'border-emerald-200/70 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/40 dark:border-emerald-500/25 dark:from-emerald-500/15 dark:via-card dark:to-card',
    icon: 'bg-emerald-500 text-white shadow-emerald-500/30',
    soft: 'border-emerald-200 bg-emerald-100/80 text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/15 dark:text-emerald-300',
    text: 'text-emerald-700 dark:text-emerald-300',
    progress: '[&>div]:bg-emerald-500',
    accent: 'from-emerald-400 via-teal-400 to-sky-400',
  },
  violet: {
    name: 'violet',
    surface: 'border-violet-200/70 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50/40 dark:border-violet-500/25 dark:from-violet-500/15 dark:via-card dark:to-card',
    icon: 'bg-violet-500 text-white shadow-violet-500/30',
    soft: 'border-violet-200 bg-violet-100/80 text-violet-800 dark:border-violet-500/25 dark:bg-violet-500/15 dark:text-violet-300',
    text: 'text-violet-700 dark:text-violet-300',
    progress: '[&>div]:bg-violet-500',
    accent: 'from-violet-400 via-fuchsia-400 to-pink-400',
  },
  sky: {
    name: 'sky',
    surface: 'border-sky-200/70 bg-gradient-to-br from-sky-50 via-white to-cyan-50/40 dark:border-sky-500/25 dark:from-sky-500/15 dark:via-card dark:to-card',
    icon: 'bg-sky-500 text-white shadow-sky-500/30',
    soft: 'border-sky-200 bg-sky-100/80 text-sky-800 dark:border-sky-500/25 dark:bg-sky-500/15 dark:text-sky-300',
    text: 'text-sky-700 dark:text-sky-300',
    progress: '[&>div]:bg-sky-500',
    accent: 'from-sky-400 via-cyan-400 to-teal-400',
  },
  amber: {
    name: 'amber',
    surface: 'border-amber-200/70 bg-gradient-to-br from-amber-50 via-white to-orange-50/40 dark:border-amber-500/25 dark:from-amber-500/15 dark:via-card dark:to-card',
    icon: 'bg-amber-500 text-white shadow-amber-500/30',
    soft: 'border-amber-200 bg-amber-100/80 text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/15 dark:text-amber-300',
    text: 'text-amber-700 dark:text-amber-300',
    progress: '[&>div]:bg-amber-500',
    accent: 'from-amber-400 via-orange-400 to-rose-400',
  },
  rose: {
    name: 'rose',
    surface: 'border-rose-200/70 bg-gradient-to-br from-rose-50 via-white to-pink-50/40 dark:border-rose-500/25 dark:from-rose-500/15 dark:via-card dark:to-card',
    icon: 'bg-rose-500 text-white shadow-rose-500/30',
    soft: 'border-rose-200 bg-rose-100/80 text-rose-800 dark:border-rose-500/25 dark:bg-rose-500/15 dark:text-rose-300',
    text: 'text-rose-700 dark:text-rose-300',
    progress: '[&>div]:bg-rose-500',
    accent: 'from-rose-400 via-pink-400 to-violet-400',
  },
  teal: {
    name: 'teal',
    surface: 'border-teal-200/70 bg-gradient-to-br from-teal-50 via-white to-emerald-50/40 dark:border-teal-500/25 dark:from-teal-500/15 dark:via-card dark:to-card',
    icon: 'bg-teal-500 text-white shadow-teal-500/30',
    soft: 'border-teal-200 bg-teal-100/80 text-teal-800 dark:border-teal-500/25 dark:bg-teal-500/15 dark:text-teal-300',
    text: 'text-teal-700 dark:text-teal-300',
    progress: '[&>div]:bg-teal-500',
    accent: 'from-teal-400 via-emerald-400 to-lime-400',
  },
};

const ROADMAP_CYCLE: FunToneName[] = ['violet', 'sky', 'amber', 'rose', 'teal'];
const PROGRESS_CYCLE: FunToneName[] = ['violet', 'sky', 'amber', 'rose', 'teal'];

export function phaseTone(index: number, status: string): FunTone {
  if (status === 'completed') return TONES.emerald;
  const position = Math.max(0, Math.floor(index) - 1) % ROADMAP_CYCLE.length;
  return TONES[ROADMAP_CYCLE[position]];
}

export function achievementTone(index: number, earned: boolean): FunTone {
  if (earned) return TONES.emerald;
  return TONES[PROGRESS_CYCLE[Math.abs(index) % PROGRESS_CYCLE.length]];
}
