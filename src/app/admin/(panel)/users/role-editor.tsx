'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@/components/ui/dialog';
import { adminToast } from '@/components/admin/client';
import { setStaffRoles, removeStaff, updateStaffDetails } from './actions';

export function RoleEditor({ userId, email, name, current, roles, self }: { userId: string; email: string; name: string; current: string[]; roles: { id: string; name: string; description: string }[]; self: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<string[]>(current);
  const [fullName, setFullName] = useState(name);
  const [mail, setMail] = useState(email);
  const [pending, start] = useTransition();
  const reset = () => { setSel(current); setFullName(name); setMail(email); };

  const save = () => start(async () => {
    const detailsChanged = fullName.trim() !== name || mail.trim().toLowerCase() !== String(email).toLowerCase();
    const rolesChanged = sel.length !== current.length || sel.some((r) => !current.includes(r));
    if (!detailsChanged && !rolesChanged) { setOpen(false); return; }
    if (detailsChanged) {
      const r = await updateStaffDetails(userId, fullName, mail);
      if (r?.error) { adminToast(r.error, 'error'); return; }
    }
    if (rolesChanged) {
      const r = await setStaffRoles(userId, sel);
      if (r?.error) { adminToast(r.error, 'error'); router.refresh(); return; }
    }
    adminToast('Saved'); setOpen(false); router.refresh();
  });

  const remove = () => start(async () => {
    const r = await removeStaff(userId);
    if (r?.error) adminToast(r.error, 'error'); else { adminToast(r?.message ?? 'Saved'); setOpen(false); router.refresh(); }
  });

  return (
    <>
      <button type="button" onClick={() => { reset(); setOpen(true); }} className="text-[13px] underline">Edit</button>
      <Dialog open={open} onClose={() => setOpen(false)} label={`Edit ${email}`} variant="modal" className="!max-w-md p-6">
        <p className="pr-10 font-display text-[22px]">Edit staff</p>
        <p className="mb-4 text-[13px] text-muted">{email}</p>
        <div className="mb-5 grid gap-3">
          <label className="grid gap-1 text-[13px]"><span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Name</span><input value={fullName} onChange={(e) => setFullName(e.target.value)} className="input" /></label>
          <label className="grid gap-1 text-[13px]"><span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Email</span><input type="email" value={mail} onChange={(e) => setMail(e.target.value)} className="input" /><span className="text-[12px] text-muted">This is also their login email. It changes straight away, no confirmation email.</span></label>
        </div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Roles</p>
        <div className="grid gap-2">
          {roles.map((r) => (
            <label key={r.id} className="flex gap-2 text-[13px]"><input type="checkbox" checked={sel.includes(r.id)} onChange={(e) => setSel(e.target.checked ? [...sel, r.id] : sel.filter((x) => x !== r.id))} className="mt-0.5" /><span><strong className="font-medium">{r.name}</strong><span className="block text-[12px] text-muted">{r.description}</span></span></label>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="button" disabled={pending} onClick={save} className="btn btn-primary btn-sm">{pending ? 'Saving…' : 'Save changes'}</button>
          {!self && <button type="button" disabled={pending} onClick={() => { if (window.confirm(`Remove all staff access for ${email}? Their customer account is kept.`)) remove(); }} className="text-[13px] text-sale underline">Remove staff access</button>}
        </div>
      </Dialog>
    </>
  );
}
