'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FlaskConical, FolderKanban, LayoutDashboard, LogOut, Map, Settings, Sparkles, Timer, Trophy, BookOpenCheck, NotebookPen } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';
import { useXp } from '@/lib/hooks/useGamification';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FocusLauncher } from '@/components/focus/focus-launcher';
import { FocusSessionProvider } from '@/lib/hooks/useFocusSession';
import { CelebrationProvider } from '@/components/celebration/celebration-provider';
import { SoundToggle, ThemeToggle } from '@/components/app-shell/shell-toggles';

const NAV: Array<{ href: string; label: string; icon: any; soon?: boolean; color: string }> = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, color: 'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300' },
  { href: '/roadmap', label: 'Roadmap', icon: Map, color: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300' },
  { href: '/focus', label: 'Focus', icon: Timer, color: 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300' },
  { href: '/log', label: 'Study Log', icon: NotebookPen, color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' },
  { href: '/projects', label: 'Projects', icon: FolderKanban, color: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300' },
  { href: '/progress', label: 'Progress', icon: Trophy, color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300' },
  { href: '/curriculum', label: 'Curriculum', icon: BookOpenCheck, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' },
  { href: '/settings', label: 'Settings', icon: Settings, color: 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300' },
];

function LevelBadge() {
  const { level, isLoading } = useXp();
  if (isLoading) return <div className="h-20 rounded-xl bg-muted animate-pulse" />;
  const pct = Math.round(level.progress * 100);
  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-fun p-3 text-white shadow-md shadow-primary/20" data-testid="sidebar-level">
      <Sparkles className="absolute -right-2 -top-2 h-12 w-12 text-white/15 rotate-12" />
      <div className="flex items-center justify-between text-xs">
        <span className="inline-flex items-center gap-1.5 font-extrabold">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[10px] font-black">{level.level}</span>
          Level {level.level}
        </span>
        <span className="font-semibold text-white/90 tabular-nums">{level.xp} XP</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/25">
        <div className="h-full rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all duration-700" style={{ width: `${Math.max(pct, 3)}%` }} />
      </div>
      <p className="mt-1.5 text-[11px] text-white/85 truncate">{level.title} · {level.remaining} XP to next</p>
    </div>
  );
}

export function AppShell({ email, children }: { email: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await createClient().auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  const navItems = NAV.map((item) => {
    const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
    const Icon = item.icon;
    const cls = cn(
      'group flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition-all duration-200',
      active ? 'bg-gradient-fun text-white font-bold shadow-md shadow-primary/25' : 'text-muted-foreground hover:bg-muted hover:text-foreground hover:translate-x-0.5',
      item.soon && 'opacity-60 cursor-not-allowed'
    );
    const iconChip = (
      <span className={cn('inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-110 group-hover:-rotate-6', active ? 'bg-white/20 text-white' : item.color)}>
        <Icon className="h-4 w-4" />
      </span>
    );
    if (item.soon) {
      return (
        <div key={item.href} className={cls} title="Coming soon" data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}>
          {iconChip} <span className="flex-1">{item.label}</span>
          <span className="text-[10px] uppercase tracking-wide rounded bg-muted px-1.5 py-0.5">soon</span>
        </div>
      );
    }
    return (
      <Link key={item.href} href={item.href} className={cls} data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}>
        {iconChip} {item.label}
      </Link>
    );
  });

  return (
    <FocusSessionProvider>
    <CelebrationProvider>
    <div className="min-h-screen flex bg-background bg-mesh">
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r bg-card/80 backdrop-blur p-4 gap-6 sticky top-0 h-screen">
        <Link href="/" className="group flex items-center gap-2.5 px-2 font-extrabold tracking-tight text-lg">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-fun text-white shadow-md shadow-primary/30 group-hover:animate-wiggle"><FlaskConical className="h-5 w-5" /></span>
          <span>Yuta&apos;s <span className="text-gradient">Lab</span></span>
        </Link>
        <nav className="flex flex-col gap-1">{navItems}</nav>
        <div className="mt-auto space-y-3">
          <LevelBadge />
          <div className="flex items-center gap-1 rounded-xl border bg-muted/40 p-1">
            <ThemeToggle className="h-8 w-8 rounded-lg" />
            <SoundToggle className="h-8 w-8 rounded-lg" />
            <span className="ml-auto text-[11px] text-muted-foreground truncate pr-1" title={email} data-testid="user-email">{email}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={signOut} title="Sign out" data-testid="signout-button"><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden sticky top-0 z-20 flex items-center gap-2 border-b bg-card/90 backdrop-blur px-4 py-3">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-fun text-white"><FlaskConical className="h-4 w-4" /></span>
          <span className="font-extrabold">Yuta&apos;s <span className="text-gradient">Lab</span></span>
          <nav className="ml-auto flex gap-0.5 overflow-x-auto">
            {NAV.filter((n) => !n.soon).map((n) => {
              const Icon = n.icon;
              const active = n.href === '/' ? pathname === '/' : pathname.startsWith(n.href);
              return (
                <Link key={n.href} href={n.href} className={cn('p-2 rounded-lg', active ? 'bg-gradient-fun text-white' : 'text-muted-foreground')} title={n.label}>
                  <Icon className="h-4 w-4" />
                </Link>
              );
            })}
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={signOut} title="Sign out"><LogOut className="h-4 w-4" /></Button>
          </nav>
        </header>
        <main className="flex-1 p-4 md:p-8 pb-24 max-w-7xl w-full mx-auto">{children}</main>
      </div>
      <FocusLauncher />
    </div>
    </CelebrationProvider>
    </FocusSessionProvider>
  );
}
