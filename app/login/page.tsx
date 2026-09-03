'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FlaskConical, Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';
import { isSupabaseConfigured, missingPublicEnv } from '@/lib/supabase/env';
import { safeNextPath } from '@/lib/security/redirect';
import { SetupRequired } from '@/components/setup-required';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type Mode = 'signin' | 'create';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get('next'));

  const [mode, setMode] = useState<Mode>('signin');
  const [ownerExists, setOwnerExists] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);

  useEffect(() => {
    fetch('/api/auth/owner-exists')
      .then((r) => r.json())
      .then((d) => {
        setOwnerExists(Boolean(d?.exists));
        if (d && d.configured && d.exists === false) setMode('create');
      })
      .catch(() => setOwnerExists(null));
  }, []);

  if (!isSupabaseConfigured()) return <SetupRequired missing={missingPublicEnv()} />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const supabase = createClient();
      if (mode === 'create') {
        const res = await fetch('/api/auth/register-owner', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Could not create the owner account.');
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      // Generic message: never reveal whether the email exists or the exact reason.
      if (signInError) throw new Error('Invalid email or password.');
      router.replace(next);
      router.refresh();
    } catch (err: any) {
      setError(err?.message || 'Invalid email or password.');
    } finally {
      setBusy(false);
    }
  }

  async function forgotPassword() {
    setError('');
    setNotice('');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError('Enter your email above, then tap "Forgot password".');
      return;
    }
    setResetBusy(true);
    try {
      const supabase = createClient();
      await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
    } catch {
      // ignore
    } finally {
      // Always show the same message regardless of whether the account exists.
      setNotice('If an account exists for that email, a password reset link has been sent.');
      setResetBusy(false);
    }
  }

  return (
    <main className="min-h-screen grid lg:grid-cols-2">
      <section className="hidden lg:flex flex-col justify-between p-12 bg-primary text-primary-foreground">
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <FlaskConical className="h-6 w-6" /> Yuta&apos;s Lab
        </div>
        <div className="space-y-6 max-w-md">
          <h1 className="text-4xl font-bold leading-tight">Healthcare AI Journey</h1>
          <p className="text-primary-foreground/80 text-lg">
            14 phases · 58 courses · 265 modules. One private lab notebook to track every step from data science fundamentals to deployed clinical AI.
          </p>
          <ul className="space-y-3 text-sm text-primary-foreground/90">
            <li className="flex items-start gap-2"><Sparkles className="h-4 w-4 mt-0.5" /> Earn XP, level up and keep your streak alive.</li>
            <li className="flex items-start gap-2"><ShieldCheck className="h-4 w-4 mt-0.5" /> Owner-only access with row-level security on every table.</li>
          </ul>
        </div>
        <p className="text-xs text-primary-foreground/60">Private workspace · Supabase Auth</p>
      </section>

      <section className="flex items-center justify-center p-6 bg-muted/30">
        <Card className="w-full max-w-md shadow-sm">
          <CardHeader>
            <div className="lg:hidden flex items-center gap-2 font-semibold mb-2"><FlaskConical className="h-5 w-5 text-primary" /> Yuta&apos;s Lab</div>
            <CardTitle className="text-2xl">{mode === 'signin' ? 'Welcome back' : 'Create the owner account'}</CardTitle>
            <CardDescription>
              {mode === 'signin'
                ? 'Sign in with your owner credentials.'
                : 'This lab is private. The first account created becomes the sole owner.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4" data-testid="login-form">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" data-testid="email-input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="password">Password</Label>
                {mode === 'signin' && (
                  <button type="button" data-testid="forgot-password" disabled={resetBusy}
                    onClick={forgotPassword}
                    className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground disabled:opacity-50">
                    {resetBusy ? 'Sending…' : 'Forgot password?'}
                  </button>
                )}
              </div>
                <Input id="password" data-testid="password-input" type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              {error && <p role="alert" data-testid="login-error" className="text-sm text-destructive">{error}</p>}
              {notice && <p role="status" data-testid="login-notice" className="text-sm text-emerald-600">{notice}</p>}
              <Button type="submit" className="w-full" disabled={busy} data-testid="login-submit">
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {mode === 'signin' ? 'Sign in' : 'Create owner & sign in'}
              </Button>
            </form>

            {ownerExists === false && (
              <button
                type="button"
                data-testid="toggle-mode"
                className="mt-4 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
                onClick={() => { setMode(mode === 'signin' ? 'create' : 'signin'); setError(''); }}
              >
                {mode === 'signin' ? 'First time here? Create the owner account' : 'Already have an account? Sign in'}
              </button>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
