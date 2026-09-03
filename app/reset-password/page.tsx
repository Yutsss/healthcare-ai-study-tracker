'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FlaskConical, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';
import { isSupabaseConfigured, missingPublicEnv } from '@/lib/supabase/env';
import { SetupRequired } from '@/components/setup-required';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetForm />
    </Suspense>
  );
}

function ResetForm() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) { setReady(true); return; }
    const supabase = createClient();
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setHasSession(true);
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session) setHasSession(true); setReady(true); });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!isSupabaseConfigured()) return <SetupRequired missing={missingPublicEnv()} />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try {
      const supabase = createClient();
      const { error: updErr } = await supabase.auth.updateUser({ password });
      if (updErr) throw new Error('Could not update the password. Your reset link may have expired — request a new one.');
      setDone(true);
      setTimeout(() => { router.replace('/'); router.refresh(); }, 1500);
    } catch (err: any) {
      setError(err?.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
      <Card className="w-full max-w-md shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2 font-semibold mb-2"><FlaskConical className="h-5 w-5 text-primary" /> Yuta&apos;s Lab</div>
          <CardTitle className="text-2xl">Set a new password</CardTitle>
          <CardDescription>
            {done ? 'Password updated. Redirecting…'
              : hasSession ? 'Choose a new password for your owner account.'
              : ready ? 'Open the reset link from your email to continue. The link starts a secure recovery session.'
              : 'Loading…'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasSession && !done && (
            <form onSubmit={submit} className="space-y-4" data-testid="reset-form">
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <Input id="password" data-testid="reset-password" type="password" minLength={8} autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input id="confirm" data-testid="reset-confirm" type="password" minLength={8} autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
              {error && <p role="alert" data-testid="reset-error" className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy} data-testid="reset-submit">
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Update password
              </Button>
            </form>
          )}
          {!hasSession && ready && (
            <Button variant="outline" className="w-full" onClick={() => router.replace('/login')}>Back to sign in</Button>
          )}
          {error && !hasSession && <p role="alert" className="text-sm text-destructive mt-3">{error}</p>}
        </CardContent>
      </Card>
    </main>
  );
}
