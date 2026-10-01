'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@/components/ui/dialog';
import { adminToast } from '@/components/admin/client';
import { setStaffRoles, removeStaff } from './actions';

export function RoleEditor({ userId, email, current, roles, self }: { userId: string; email: string; current: string[]; roles: { id: string; name: string; description: string }[]; self: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<string[]>(current);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<any>) => start(async () => { const r = await fn(); if (r?.error) adminToast(r.error, 'error'); else { adminToast(r?.message ?? 'Saved'); setOpen(false); router.refresh(); } });
  return (
    <>
      <button type="button" onClick={() => { setSel(current); setOpen(true); }} className="text-[13px] underline">Edit</button>
      <Dialog open={open} onClose={() => setOpen(false)} label={`Roles for ${email}`} variant="modal" className="!max-w-md p-6">
        <p className="pr-10 font-display text-[22px]">Roles</p>
        <p className="mb-4 text-[13px] text-muted">{email}</p>
        <div className="grid gap-2">
          {roles.map((r) => (
            <label key={r.id} className="flex gap-2 text-[13px]"><input type="checkbox" checked={sel.includes(r.id)} onChange={(e) => setSel(e.target.checked ? [...sel, r.id] : sel.filter((x) => x !== r.id))} className="mt-0.5" /><span><strong className="font-medium">{r.name}</strong><span className="block text-[12px] text-muted">{r.description}</span></span></label>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="button" disabled={pending} onClick={() => run(() => setStaffRoles(userId, sel))} className="btn btn-primary btn-sm">{pending ? 'Saving…' : 'Save roles'}</button>
          {!self && <button type="button" disabled={pending} onClick={() => { if (window.confirm(`Remove all staff access for ${email}? Their customer account is kept.`)) run(() => removeStaff(userId)); }} className="text-[13px] text-sale underline">Remove staff access</button>}
        </div>
      </Dialog>
    </>
  );
}
