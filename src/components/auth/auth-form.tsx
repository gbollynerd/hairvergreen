'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';

type Mode = 'login' | 'register' | 'forgot' | 'reset' | 'admin';

export function AuthForm({ mode, next = '/account' }: { mode: Mode; next?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'error' | 'ok'; text: string } | null>(null);
  const google = process.env.NEXT_PUBLIC_AUTH_GOOGLE === '1';
  const apple = process.env.NEXT_PUBLIC_AUTH_APPLE === '1';

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get('email') || '').trim();
    const password = String(fd.get('password') || '');
    const sb = supabaseBrowser();
    try {
      if (mode === 'login' || mode === 'admin') {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace(next); router.refresh();
      } else if (mode === 'register') {
        if (password.length < 8) throw new Error('Use at least 8 characters for your password.');
        const { data, error } = await sb.auth.signUp({ email, password, options: {
          emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          data: { full_name: String(fd.get('full_name') || ''), phone: String(fd.get('phone') || ''), marketing_email: fd.get('marketing') === 'on' },
        } });
        if (error) throw error;
        if (data.session) { router.replace(next); router.refresh(); }
        else setMsg({ tone: 'ok', text: 'Check your inbox to confirm your email, then sign in.' });
      } else if (mode === 'forgot') {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/auth/callback?next=/reset-password` });
        if (error) throw error;
        setMsg({ tone: 'ok', text: 'If an account exists for that email, a reset link is on its way.' });
      } else if (mode === 'reset') {
        if (password.length < 8) throw new Error('Use at least 8 characters.');
        const { error } = await sb.auth.updateUser({ password });
        if (error) throw error;
        setMsg({ tone: 'ok', text: 'Password updated.' });
        setTimeout(() => router.replace('/account'), 800);
      }
    } catch (err) {
      const text = err instanceof Error ? err.message : 'Something went wrong';
      setMsg({ tone: 'error', text: /invalid login/i.test(text) ? 'That email and password don’t match our records.' : text });
    } finally { setBusy(false); }
  }

  const oauth = async (provider: 'google' | 'apple') => {
    await supabaseBrowser().auth.signInWithOAuth({ provider, options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` } });
  };

  return (
    <form onSubmit={submit} className="mt-8 grid gap-5">
      {mode === 'register' && (
        <>
          <label className="field"><span className="label">Full name</span><input name="full_name" required className="input" autoComplete="name" /></label>
          <label className="field"><span className="label">Phone (optional)</span><input name="phone" className="input" autoComplete="tel" /></label>
        </>
      )}
      {mode !== 'reset' && <label className="field"><span className="label">Email</span><input name="email" type="email" required className="input" autoComplete="email" /></label>}
      {mode !== 'forgot' && (
        <label className="field"><span className="label">{mode === 'reset' ? 'New password' : 'Password'}</span>
          <input name="password" type="password" required minLength={mode === 'login' || mode === 'admin' ? 1 : 8} className="input" autoComplete={mode === 'login' || mode === 'admin' ? 'current-password' : 'new-password'} /></label>
      )}
      {mode === 'register' && (
        <label className="flex items-start gap-3 text-[14px] text-muted"><input type="checkbox" name="marketing" className="mt-1 h-4 w-4 accent-[var(--hg-primary)]" /> Send me new drops, offers and hair care tips.</label>
      )}
      {msg && <p className={msg.tone === 'error' ? 'text-[13px] text-sale' : 'bg-panel p-3 text-[14px]'} role={msg.tone === 'error' ? 'alert' : 'status'}>{msg.text}</p>}
      <button type="submit" disabled={busy} className="btn btn-primary">{busy ? 'Please wait…' : { login: 'Sign in', admin: 'Sign in', register: 'Create account', forgot: 'Send reset link', reset: 'Update password' }[mode]}</button>
      {(mode === 'login' || mode === 'register') && (google || apple) && (
        <div className="grid gap-3">
          <p className="text-center text-[12px] uppercase tracking-[0.2em] text-muted">or</p>
          {google && <button type="button" onClick={() => oauth('google')} className="btn btn-outline">Continue with Google</button>}
          {apple && <button type="button" onClick={() => oauth('apple')} className="btn btn-outline">Continue with Apple</button>}
        </div>
      )}
    </form>
  );
}
