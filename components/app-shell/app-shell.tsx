'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FlaskConical, FolderKanban, LayoutDashboard, LogOut, Map, Settings, Timer, Trophy, BookOpenCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';
import { useXp } from '@/lib/hooks/useGamification';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { QuickLogWidget } from '@/components/quick-log/quick-log-widget';

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/roadmap', label: 'Roadmap', icon: Map },
  { href: '/projects', label: 'Projects', icon: FolderKanban, soon: true },
  { href: '/log', label: 'Quick Log', icon: Timer },
  { href: '/progress', label: 'Progress', icon: Trophy },
  { href: '/curriculum', label: 'Curriculum', icon: BookOpenCheck, soon: true },
  { href: '/settings', label: 'Settings', icon: Settings },
];

function LevelBadge() {
  const { level, isLoading } = useXp();
  if (isLoading) return <div className="h-14 rounded-lg bg-muted animate-pulse" />;
  return (
    <div className="rounded-lg border bg-card p-3 space-y-2" data-testid="sidebar-level">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold">Level {level.level}</span>
        <span className="text-muted-foreground">{level.xp} XP</span>
      </div>
      <Progress value={Math.round(level.progress * 100)} className="h-1.5" />
      <p className="text-[11px] text-muted-foreground truncate">{level.title} · {level.remaining} XP to next</p>
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
      'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
      active ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      item.soon && 'opacity-60 cursor-not-allowed'
    );
    if (item.soon) {
      return (
        <div key={item.href} className={cls} title="Coming soon" data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}>
          <Icon className="h-4 w-4" /> <span className="flex-1">{item.label}</span>
          <span className="text-[10px] uppercase tracking-wide rounded bg-muted px-1.5 py-0.5">soon</span>
        </div>
      );
    }
    return (
      <Link key={item.href} href={item.href} className={cls} data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}>
        <Icon className="h-4 w-4" /> {item.label}
      </Link>
    );
  });

  return (
    <div className="min-h-screen flex bg-muted/30">
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r bg-card p-4 gap-6 sticky top-0 h-screen">
        <Link href="/" className="flex items-center gap-2 px-2 font-semibold tracking-tight">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"><FlaskConical className="h-4 w-4" /></span>
          <span>Yuta&apos;s Lab</span>
        </Link>
        <nav className="flex flex-col gap-1">{navItems}</nav>
        <div className="mt-auto space-y-3">
          <LevelBadge />
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="text-xs text-muted-foreground truncate" title={email} data-testid="user-email">{email}</span>
            <Button variant="ghost" size="icon" onClick={signOut} title="Sign out" data-testid="signout-button"><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden sticky top-0 z-20 flex items-center gap-2 border-b bg-card px-4 py-3">
          <FlaskConical className="h-5 w-5 text-primary" />
          <span className="font-semibold">Yuta&apos;s Lab</span>
          <nav className="ml-auto flex gap-1">
            {NAV.filter((n) => !n.soon).map((n) => {
              const Icon = n.icon;
              const active = n.href === '/' ? pathname === '/' : pathname.startsWith(n.href);
              return (
                <Link key={n.href} href={n.href} className={cn('p-2 rounded-md', active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')} title={n.label}>
                  <Icon className="h-4 w-4" />
                </Link>
              );
            })}
            <Button variant="ghost" size="icon" onClick={signOut} title="Sign out"><LogOut className="h-4 w-4" /></Button>
          </nav>
        </header>
        <main className="flex-1 p-4 md:p-8 pb-24 max-w-7xl w-full mx-auto">{children}</main>
      </div>
      <QuickLogWidget />
    </div>
  );
}
