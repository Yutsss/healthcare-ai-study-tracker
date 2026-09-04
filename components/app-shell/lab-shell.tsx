'use client';

import React from 'react';
import Link from 'next/link';
import {
  BookOpenCheck,
  FlaskConical,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Map,
  RotateCcw,
  Settings,
  Sparkles,
  Timer,
  Trophy,
  NotebookPen,
  type LucideIcon,
} from 'lucide-react';
import type { LevelInfo } from '@/lib/gamification';
import { isLabRouteActive, type LabRouteMap } from '@/lib/lab/routes';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { SoundToggle, ThemeToggle } from '@/components/app-shell/shell-toggles';
import { cn } from '@/lib/utils';

type NavItem = { key: keyof LabRouteMap; label: string; icon: LucideIcon; color: string };

const PRIMARY_NAV: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, color: 'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300' },
  { key: 'roadmap', label: 'Roadmap', icon: Map, color: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300' },
  { key: 'focus', label: 'Focus', icon: Timer, color: 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300' },
  { key: 'log', label: 'Study Log', icon: NotebookPen, color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' },
  { key: 'projects', label: 'Projects', icon: FolderKanban, color: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300' },
  { key: 'progress', label: 'Progress', icon: Trophy, color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300' },
];

const OWNER_NAV = [
  { href: '/curriculum', label: 'Curriculum', icon: BookOpenCheck, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' },
  { href: '/settings', label: 'Settings', icon: Settings, color: 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300' },
];

export type LabShellProps = {
  mode: 'owner' | 'demo';
  routes: LabRouteMap;
  pathname: string;
  level: LevelInfo;
  levelLoading?: boolean;
  identityLabel: string;
  storageWarning?: string | null;
  onReset?: () => void;
  onSignOut?: () => Promise<void> | void;
  overlay?: React.ReactNode;
  children: React.ReactNode;
};

function LevelBadge({ level, loading }: { level: LevelInfo; loading: boolean }) {
  if (loading) return <div className="h-20 rounded-xl bg-muted animate-pulse" />;
  const percent = Math.round(level.progress * 100);
  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-fun p-3 text-white shadow-md shadow-primary/20" data-testid="sidebar-level">
      <Sparkles className="absolute -right-2 -top-2 h-12 w-12 rotate-12 text-white/15" />
      <div className="flex items-center justify-between text-xs">
        <span className="inline-flex items-center gap-1.5 font-extrabold">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[10px] font-black">{level.level}</span>
          Level {level.level}
        </span>
        <span className="font-semibold tabular-nums text-white/90">{level.xp} XP</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/25">
        <div className="h-full rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all duration-700" style={{ width: `${Math.max(percent, 3)}%` }} />
      </div>
      <p className="mt-1.5 truncate text-[11px] text-white/85">{level.title} · {level.remaining} XP to next</p>
    </div>
  );
}

function DesktopLink({ href, label, icon: Icon, color, pathname }: { href: string; label: string; icon: LucideIcon; color: string; pathname: string }) {
  const active = isLabRouteActive(pathname, href);
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition-all duration-200',
        active ? 'bg-gradient-fun font-bold text-white shadow-md shadow-primary/25' : 'text-muted-foreground hover:translate-x-0.5 hover:bg-muted hover:text-foreground',
      )}
      data-testid={`nav-${label.toLowerCase().replace(' ', '-')}`}
    >
      <span className={cn('inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:-rotate-6 group-hover:scale-110', active ? 'bg-white/20 text-white' : color)}>
        <Icon className="h-4 w-4" />
      </span>
      {label}
    </Link>
  );
}

export function LabShell({
  mode,
  routes,
  pathname,
  level,
  levelLoading = false,
  identityLabel,
  storageWarning,
  onReset,
  onSignOut,
  overlay,
  children,
}: LabShellProps) {
  const primaryItems = PRIMARY_NAV.map((item) => ({ ...item, href: routes[item.key] }));

  return (
    <div className="flex min-h-screen bg-background bg-mesh">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-6 border-r bg-card/80 p-4 backdrop-blur md:flex">
        <Link href={routes.dashboard} className="group flex items-center gap-2.5 px-2 text-lg font-extrabold tracking-tight">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-fun text-white shadow-md shadow-primary/30 group-hover:animate-wiggle"><FlaskConical className="h-5 w-5" /></span>
          <span>Yuta&apos;s <span className="text-gradient">Lab</span></span>
        </Link>
        <nav aria-label="Primary navigation" className="flex flex-col gap-1">
          {primaryItems.map((item) => <DesktopLink key={item.key} {...item} pathname={pathname} />)}
        </nav>
        {mode === 'owner' && (
          <nav aria-label="Owner navigation" className="flex flex-col gap-1 border-t pt-3">
            {OWNER_NAV.map((item) => <DesktopLink key={item.href} {...item} pathname={pathname} />)}
          </nav>
        )}
        <div className="mt-auto space-y-3">
          <LevelBadge level={level} loading={levelLoading} />
          {mode === 'demo' && onReset && (
            <AlertDialog>
              <AlertDialogTrigger asChild><Button type="button" variant="outline" className="w-full"><RotateCcw className="h-4 w-4" /> Reset demo</Button></AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset your local demo?</AlertDialogTitle>
                  <AlertDialogDescription>This removes only demo data from this browser and restores zero progress plus the starter project.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onReset}>Reset local demo</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <div className="flex items-center gap-1 rounded-xl border bg-muted/40 p-1">
            <ThemeToggle className="h-8 w-8 rounded-lg" />
            <SoundToggle className="h-8 w-8 rounded-lg" />
            <span
              className="ml-auto truncate pr-1 text-[11px] text-muted-foreground"
              title={identityLabel}
              data-testid={mode === 'owner' ? 'user-identity' : 'demo-identity'}
            >{identityLabel}</span>
            {mode === 'owner' && onSignOut && <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onSignOut} title="Sign out" aria-label="Sign out"><LogOut className="h-4 w-4" /></Button>}
          </div>
          {mode === 'demo' && <Button variant="ghost" size="sm" asChild className="w-full"><Link href="/showcase">Exit to showcase</Link></Button>}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-2 border-b bg-card/90 px-4 py-3 backdrop-blur md:hidden">
          <Link href={routes.dashboard} className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-fun text-white"><FlaskConical className="h-4 w-4" /></span>
            <span className="font-extrabold">Yuta&apos;s <span className="text-gradient">Lab</span></span>
          </Link>
          <nav aria-label="Mobile navigation" className="ml-auto flex gap-0.5 overflow-x-auto">
            {primaryItems.map((item) => {
              const Icon = item.icon;
              const active = isLabRouteActive(pathname, item.href);
              return (
                <Link key={item.key} href={item.href} aria-current={active ? 'page' : undefined} className={cn('rounded-lg p-2', active ? 'bg-gradient-fun text-white' : 'text-muted-foreground')} title={item.label} aria-label={item.label}>
                  <Icon className="h-4 w-4" />
                </Link>
              );
            })}
            <ThemeToggle />
            {mode === 'owner' && onSignOut && <Button variant="ghost" size="icon" onClick={onSignOut} title="Sign out" aria-label="Sign out from mobile"><LogOut className="h-4 w-4" /></Button>}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 pb-24 md:p-8 md:pb-24">
          {storageWarning && <p role="status" className="mb-5 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{storageWarning}</p>}
          {children}
        </main>
      </div>
      {overlay}
    </div>
  );
}
