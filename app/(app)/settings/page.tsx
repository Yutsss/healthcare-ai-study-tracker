'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Database, Eye, Loader2, LogOut, RefreshCw, Upload } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';
import type { ImportResult } from '@/lib/seed/importSeed';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useShowcaseSettings, useUpdateShowcaseSettings } from '@/lib/hooks/useShowcaseSettings';

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data as T;
}

type StatusResp = { ownerId: string; counts: Record<string, number> };

function ResultTable({ result }: { result: ImportResult }) {
  const rows: Array<[string, keyof ImportResult]> = [
    ['Phases (roadmap)', 'roadmap_items'], ['Courses (units)', 'course_units'], ['Modules', 'modules'], ['Milestones', 'milestones'], ['Starter projects', 'projects'],
  ];
  return (
    <div className="overflow-x-auto rounded-lg border" data-testid="import-result">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
          <tr><th className="text-left px-3 py-2">Entity</th><th className="px-3 py-2 text-right">In seed</th><th className="px-3 py-2 text-right">{result.dryRun ? 'Would insert' : 'Inserted'}</th><th className="px-3 py-2 text-right">{result.dryRun ? 'Would update' : 'Updated'}</th><th className="px-3 py-2 text-right">Kept (edited)</th><th className="px-3 py-2 text-right">Orphans</th></tr>
        </thead>
        <tbody>
          {rows.map(([label, key]) => {
            const r = result[key] as ImportResult['modules'];
            return (
              <tr key={key} className="border-t">
                <td className="px-3 py-2">{label}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.total}</td>
                <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{r.inserted}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.updated}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{r.skipped_manual}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{r.skipped_orphan}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [imported, setImported] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState<'preview' | 'import' | null>(null);
  const [showcaseEnabled, setShowcaseEnabled] = useState(false);
  const [showcaseBio, setShowcaseBio] = useState('');

  const status = useQuery({ queryKey: ['seed-status'], queryFn: () => api<StatusResp>('/api/seed/status'), retry: false });
  const me = useQuery({
    queryKey: ['me'],
    queryFn: async () => { const { data } = await createClient().auth.getUser(); return data.user; },
  });
  const showcase = useShowcaseSettings();
  const updateShowcase = useUpdateShowcaseSettings();

  useEffect(() => {
    if (showcase.settings) {
      setShowcaseEnabled(showcase.settings.showcase_enabled);
      setShowcaseBio(showcase.settings.showcase_bio || '');
    }
  }, [showcase.settings]);

  async function runPreview() {
    setBusy('preview');
    try { setPreview(await api<ImportResult>('/api/seed/preview')); setImported(null); }
    catch (e: any) { toast.error('Preview failed', { description: e.message }); }
    finally { setBusy(null); }
  }

  async function runImport() {
    setBusy('import');
    try {
      const res = await api<ImportResult>('/api/seed/import', { method: 'POST', body: JSON.stringify({}) });
      setImported(res); setPreview(null);
      toast.success('Curriculum imported', { description: `${res.modules.inserted} new modules, ${res.modules.updated} refreshed.` });
      qc.invalidateQueries({ queryKey: ['curriculum'] });
      status.refetch();
    } catch (e: any) { toast.error('Import failed', { description: e.message }); }
    finally { setBusy(null); }
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  async function saveShowcaseSettings() {
    try {
      await updateShowcase.mutateAsync({ showcase_enabled: showcaseEnabled, showcase_bio: showcaseBio });
      toast.success('Showcase settings saved');
    } catch (e: any) {
      toast.error('Could not save showcase settings', { description: e.message });
    }
  }

  const schemaMissing = status.isError && /relation|does not exist|schema cache|Could not find/i.test((status.error as Error)?.message || '');
  const result = imported || preview;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Owner tools: account, database and curriculum seed.</p>
      </div>

      <Card data-testid="account-card">
        <CardHeader><CardTitle className="text-base">Account</CardTitle><CardDescription>You are the sole owner of this lab.</CardDescription></CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <p className="font-medium">{me.data?.email || '…'}</p>
            <p className="text-xs text-muted-foreground">User ID: <code>{me.data?.id || '…'}</code></p>
          </div>
          <Button variant="outline" onClick={signOut} data-testid="settings-signout"><LogOut className="h-4 w-4 mr-2" /> Sign out</Button>
        </CardContent>
      </Card>

      <Card data-testid="showcase-card">
        <CardHeader>
          <CardTitle className="text-base">Public showcase</CardTitle>
          <CardDescription>Choose exactly what appears on your public portfolio page.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div className="space-y-1">
              <Label htmlFor="showcase-enabled" className="font-medium">Enable public showcase</Label>
              <p className="text-xs text-muted-foreground">Off by default. Your showcase stays private until you enable it.</p>
            </div>
            <Switch id="showcase-enabled" checked={showcaseEnabled} onCheckedChange={setShowcaseEnabled} disabled={showcase.isLoading} data-testid="showcase-enabled" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="showcase-bio">Public bio</Label>
            <Textarea id="showcase-bio" value={showcaseBio} onChange={(event) => setShowcaseBio(event.target.value)} maxLength={500} rows={4} placeholder="A short introduction for your public showcase" data-testid="showcase-bio" />
            <p className="text-xs text-muted-foreground">Up to 500 characters. Only include information you are comfortable sharing publicly.</p>
          </div>
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            Enabling this shares your display name, public bio, selected progress, and only projects individually marked “Show in public showcase.”
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={saveShowcaseSettings} disabled={showcase.isLoading || updateShowcase.isPending} data-testid="showcase-save">
              {updateShowcase.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save showcase settings
            </Button>
            <Button variant="outline" asChild><Link href="/showcase">Preview public showcase</Link></Button>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="database-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Database className="h-4 w-4" /> Database</CardTitle>
          <CardDescription>Your current content counts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {status.isLoading && <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Checking…</p>}
          {status.isError && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm space-y-1">
              <p className="font-medium flex items-center gap-2 text-amber-800"><AlertTriangle className="h-4 w-4" /> {schemaMissing ? 'Not set up yet' : 'Could not load your data'}</p>
              {schemaMissing
                ? <p className="text-amber-900/80">Your workspace has not finished setting up yet. Please try again shortly.</p>
                : <p className="text-amber-900/80">Something went wrong loading your data. Please refresh and try again.</p>}
            </div>
          )}
          {status.data && (
            <div className="grid gap-2 sm:grid-cols-3 md:grid-cols-4">
              {Object.entries(status.data.counts).map(([k, v]) => (
                <div key={k} className="rounded-lg border p-3" data-testid={`count-${k}`}>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{k.replace(/_/g, ' ')}</p>
                  <p className="text-xl font-bold tabular-nums">{v}</p>
                </div>
              ))}
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={() => status.refetch()} data-testid="refresh-status"><RefreshCw className="h-3.5 w-3.5 mr-2" /> Refresh</Button>
        </CardContent>
      </Card>

      <Card data-testid="seed-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Upload className="h-4 w-4" /> Curriculum seed</CardTitle>
          <CardDescription>
            Idempotent import of <code>yutas-lab-course-seed.json</code> (14 phases · 58 courses · 265 modules · 4 milestones · 1 starter project).
            Re-running never deletes anything, never touches your progress, and keeps items you edited manually.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={runPreview} disabled={busy !== null} data-testid="seed-preview">
              {busy === 'preview' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />} Preview changes
            </Button>
            <Button onClick={runImport} disabled={busy !== null} data-testid="seed-import">
              {busy === 'import' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />} Import / refresh curriculum
            </Button>
          </div>
          {result && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                {result.dryRun ? <Badge variant="secondary">Preview — nothing written</Badge> : <Badge className="bg-emerald-600 hover:bg-emerald-600"><CheckCircle2 className="h-3 w-3 mr-1" /> Imported</Badge>}
              </div>
              <ResultTable result={result} />
              {result.warnings.length > 0 && (
                <details className="text-xs text-muted-foreground"><summary>{result.warnings.length} warning(s)</summary>
                  <ul className="list-disc pl-5 mt-1 space-y-0.5">{result.warnings.slice(0, 50).map((w, i) => <li key={i}>{w}</li>)}</ul>
                </details>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
