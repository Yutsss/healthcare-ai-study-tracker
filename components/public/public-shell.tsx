import React from 'react';
import Link from 'next/link';
import { FlaskConical } from 'lucide-react';

type PublicShellProps = {
  mode: 'showcase' | 'demo';
  children: React.ReactNode;
};

const modeCopy = {
  showcase: 'Public showcase',
  demo: 'Interactive demo',
} as const;

export function PublicShell({ mode, children }: PublicShellProps) {
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4 md:px-8">
          <Link href="/showcase" className="flex items-center gap-2 font-extrabold tracking-tight text-lg">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-fun text-white shadow-md shadow-primary/30">
              <FlaskConical className="h-5 w-5" />
            </span>
            <span>Yuta&apos;s <span className="text-gradient">Lab</span></span>
          </Link>
          <nav aria-label="Public navigation" className="flex flex-wrap items-center gap-4 text-sm font-medium">
            <Link href="/showcase" className="text-foreground underline-offset-4 hover:underline">Showcase</Link>
            <Link href="/demo" className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Try demo</Link>
            <Link href="/login" className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Owner sign in</Link>
          </nav>
          <span className="ml-auto inline-flex items-center rounded-full border bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground" data-testid="public-mode-badge">
            {modeCopy[mode]}
          </span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8 md:py-12">{children}</main>
    </div>
  );
}
