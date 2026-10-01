'use client';
import { useActionState } from 'react';
import { saveDetails, savePreferences } from '@/app/(store)/account/actions';

export function DetailsForm({ profile }: { profile: { full_name: string | null; phone: string | null; birthday: string | null } }) {
  const [state, action, pending] = useActionState(saveDetails, null as null | { error?: string; ok?: boolean });
  return (
    <form action={action} className="mt-6 grid gap-4">
      <label className="field"><span className="label">Full name</span><input name="full_name" defaultValue={profile.full_name ?? ''} className="input" /></label>
      <label className="field"><span className="label">Phone</span><input name="phone" defaultValue={profile.phone ?? ''} className="input" /></label>
      <label className="field"><span className="label">Birthday (optional)</span><input type="date" name="birthday" defaultValue={profile.birthday ?? ''} className="input" /></label>
      {state?.error && <p className="text-[13px] text-sale" role="alert">{state.error}</p>}
      {state?.ok && <p className="text-[13px]" role="status">Saved.</p>}
      <button disabled={pending} className="btn btn-primary justify-self-start">{pending ? 'Saving…' : 'Save details'}</button>
    </form>
  );
}

export function PreferencesForm({ prefs }: { prefs: Record<string, boolean | undefined> }) {
  const [state, action, pending] = useActionState(savePreferences, null as null | { error?: string; ok?: boolean });
  const rows: [string, string, string][] = [
    ['notify_order_updates', 'Order & shipping updates', 'Dispatch, tracking and delivery notifications'],
    ['notify_restock', 'Restock alerts', 'When saved or sold-out pieces return'],
    ['notify_promotions', 'Promotions', 'Sales and limited-time offers'],
    ['marketing_email', 'News & new drops by email', 'Launches, the Hair Journal and hair care tips'],
    ['marketing_sms', 'SMS / WhatsApp offers', 'Occasional messages about drops and offers'],
  ];
  return (
    <form action={action} className="mt-6 divide-y divide-line border-y border-line">
      {rows.map(([k, t, d]) => (
        <label key={k} className="flex items-center justify-between gap-6 py-4">
          <span><span className="block text-[15px]">{t}</span><span className="text-[13px] text-muted">{d}</span></span>
          <input type="checkbox" name={k} defaultChecked={prefs[k] ?? false} className="h-5 w-5 accent-[var(--hg-primary)]" />
        </label>
      ))}
      <div className="flex items-center gap-4 py-5">
        <button disabled={pending} className="btn btn-primary">{pending ? 'Saving…' : 'Save preferences'}</button>
        {state?.ok && <span className="text-[13px]" role="status">Saved.</span>}{state?.error && <span className="text-[13px] text-sale">{state.error}</span>}
      </div>
    </form>
  );
}
