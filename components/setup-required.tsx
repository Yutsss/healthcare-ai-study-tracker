import { AlertTriangle, Database, KeyRound, Terminal } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function SetupRequired({ missing }: { missing: string[] }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-muted/40">
      <Card className="max-w-2xl w-full">
        <CardHeader>
          <div className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">Setup required</span>
          </div>
          <CardTitle className="text-2xl">Yuta&apos;s Lab needs its Supabase project</CardTitle>
          <CardDescription>The app is installed but cannot reach Supabase yet. Finish these steps and restart the server.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 text-sm">
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-medium"><KeyRound className="h-4 w-4" /> 1. Environment variables (<code className="px-1 rounded bg-muted">/app/.env</code>)</div>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              {missing.length ? missing.map((m) => (
                <li key={m}><code className="px-1 rounded bg-muted text-foreground">{m}</code> is missing</li>
              )) : <li>All public variables present.</li>}
              <li>Find the Project URL in Supabase → Project Settings → API (looks like <code className="px-1 rounded bg-muted">https://xxxx.supabase.co</code>).</li>
            </ul>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-medium"><Database className="h-4 w-4" /> 2. Database schema</div>
            <p className="text-muted-foreground">Run <code className="px-1 rounded bg-muted text-foreground">supabase/migrations/001_init.sql</code> in the Supabase SQL Editor (creates all tables, RLS policies and XP triggers). Optional: run <code className="px-1 rounded bg-muted text-foreground">000_bootstrap_exec_sql.sql</code> first so future migrations can be applied with <code className="px-1 rounded bg-muted text-foreground">node scripts/apply-migrations.mjs</code>.</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-medium"><Terminal className="h-4 w-4" /> 3. Restart</div>
            <p className="text-muted-foreground">Restart the Next.js server so the new environment variables are loaded, then sign in / create the owner account.</p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
