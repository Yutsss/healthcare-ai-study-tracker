'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Pause, Timer } from 'lucide-react';
import { useFocusSession } from '@/lib/hooks/useFocusSession';
import { fmtClock, PHASE_META } from '@/lib/focus';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Floating launcher / live indicator for Focus Mode (replaces manual duration entry). */
export function FocusLauncher() {
  const pathname = usePathname();
  const router = useRouter();
  const { session, live } = useFocusSession();
  if (pathname.startsWith('/focus')) return null;

  if (!session || !live) {
    return (
      <div className="fixed bottom-5 right-5 z-40">
        <Button size="lg" data-testid="focus-launcher" className="rounded-full shadow-lg gap-2 pl-4 pr-5" onClick={() => router.push('/focus')}>
          <Timer className="h-4 w-4" /> Focus
        </Button>
      </div>
    );
  }

  const isFocus = session.phase === 'focus';
  return (
    <div className="fixed bottom-5 right-5 z-40">
      <Button size="lg" data-testid="focus-launcher-active" onClick={() => router.push('/focus')}
        className={cn('rounded-full shadow-lg gap-2 pl-4 pr-5 text-white',
          !session.running ? 'bg-slate-600 hover:bg-slate-600/90' : isFocus ? 'bg-orange-500 hover:bg-orange-500/90' : 'bg-sky-500 hover:bg-sky-500/90')}>
        {session.running ? <Timer className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
        <span className="tabular-nums font-semibold">{fmtClock(live.remainingMs)}</span>
        <span className="text-xs opacity-90">{PHASE_META[session.phase].short}{!session.running ? ' · paused' : ''}</span>
      </Button>
    </div>
  );
}
