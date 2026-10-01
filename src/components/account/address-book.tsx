'use client';
import { useActionState, useState } from 'react';
import type { Address } from '@/lib/types';
import { saveAddress, deleteAddress, setDefaultAddress } from '@/app/(store)/account/actions';
import { COUNTRIES, NIGERIAN_STATES, countryName } from '@/lib/utils';

export function AddressBook({ addresses }: { addresses: Address[] }) {
  const [editing, setEditing] = useState<Address | 'new' | null>(addresses.length ? null : 'new');
  return (
    <div>
      <div className="flex items-center justify-between"><h2 className="font-display text-[26px]">Addresses</h2>{editing === null && <button type="button" onClick={() => setEditing('new')} className="btn btn-outline btn-sm">Add address</button>}</div>
      {editing && <AddressForm address={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />}
      <ul className="mt-6 grid gap-4 md:grid-cols-2">
        {addresses.map((a) => (
          <li key={a.id} className="border border-line bg-surface p-5 text-[14px]">
            <div className="flex items-start justify-between gap-2"><p className="font-medium">{a.label || `${a.first_name} ${a.last_name}`}</p>{a.is_default_shipping && <span className="bg-panel px-2 py-0.5 text-[10px] uppercase tracking-[0.16em]">Default</span>}</div>
            <p className="mt-2 text-muted">{a.first_name} {a.last_name}<br />{a.line1}{a.line2 && `, ${a.line2}`}<br />{a.city}{a.state && `, ${a.state}`} {a.postal_code}<br />{countryName(a.country)}{a.phone && <><br />{a.phone}</>}</p>
            <div className="mt-4 flex gap-4 text-[13px]">
              <button type="button" className="underline" onClick={() => setEditing(a)}>Edit</button>
              {!a.is_default_shipping && <button type="button" className="underline" onClick={() => setDefaultAddress(a.id!)}>Make default</button>}
              <button type="button" className="text-muted underline" onClick={() => { if (confirm('Delete this address?')) deleteAddress(a.id!); }}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AddressForm({ address, onDone }: { address: Address | null; onDone: () => void }) {
  const [state, action, pending] = useActionState(async (prev: unknown, fd: FormData) => { const r = await saveAddress(prev, fd); if ('ok' in r) onDone(); return r; }, null as null | { error?: string; ok?: boolean });
  const [country, setCountry] = useState(address?.country ?? 'NG');
  return (
    <form action={action} className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-4 border border-line bg-surface p-4 sm:p-6 md:grid-cols-2">
      {address?.id && <input type="hidden" name="id" value={address.id} />}
      <label className="field md:col-span-2"><span className="label">Label (e.g. Home, Office)</span><input name="label" defaultValue={address?.label ?? ''} className="input" /></label>
      <label className="field"><span className="label">First name</span><input name="first_name" required defaultValue={address?.first_name} className="input" /></label>
      <label className="field"><span className="label">Last name</span><input name="last_name" required defaultValue={address?.last_name} className="input" /></label>
      <label className="field md:col-span-2"><span className="label">Address</span><input name="line1" required defaultValue={address?.line1} className="input" /></label>
      <label className="field md:col-span-2"><span className="label">Apartment, landmark</span><input name="line2" defaultValue={address?.line2 ?? ''} className="input" /></label>
      <label className="field"><span className="label">City</span><input name="city" required defaultValue={address?.city} className="input" /></label>
      <label className="field"><span className="label">Country</span><select name="country" value={country} onChange={(e) => setCountry(e.target.value)} className="input">{COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select></label>
      {country === 'NG' ? <label className="field"><span className="label">State</span><select name="state" defaultValue={address?.state ?? ''} className="input" required><option value="">Select</option>{NIGERIAN_STATES.map((s) => <option key={s}>{s}</option>)}</select></label>
        : <label className="field"><span className="label">State / Region</span><input name="state" defaultValue={address?.state ?? ''} className="input" /></label>}
      <label className="field"><span className="label">Postcode</span><input name="postal_code" defaultValue={address?.postal_code ?? ''} className="input" /></label>
      <label className="field"><span className="label">Phone</span><input name="phone" defaultValue={address?.phone ?? ''} className="input" /></label>
      <label className="flex items-center gap-3 text-[14px] md:col-span-2"><input type="checkbox" name="is_default_shipping" defaultChecked={address?.is_default_shipping} className="h-4 w-4 accent-[var(--hg-primary)]" /> Default delivery address</label>
      {state?.error && <p className="text-[13px] text-sale md:col-span-2" role="alert">{state.error}</p>}
      <div className="flex flex-wrap gap-3 md:col-span-2"><button disabled={pending} className="btn btn-primary">{pending ? 'Saving…' : 'Save address'}</button><button type="button" onClick={onDone} className="btn btn-outline">Cancel</button></div>
    </form>
  );
}
