'use client';
import { useState } from 'react';
import { ActionForm, Submit, Field, Toggle } from '@/components/admin/client';
import { updateReturn } from '../actions';

export function ReturnActions({ id, status, note, restocked }: { id: string; status: string; note: string | null; restocked: boolean }) {
  const [s, setS] = useState(status === 'requested' ? 'approved' : status);
  return (
    <ActionForm action={updateReturn} className="grid gap-3">
      <input type="hidden" name="id" value={id} />
      <Field label="Status"><select name="status" value={s} onChange={(e) => setS(e.target.value)} className="input">
        {[['approved', 'Approve'], ['rejected', 'Reject'], ['awaiting_item', 'Awaiting item'], ['received', 'Item received'], ['exchanged', 'Exchange sent'], ['closed', 'Close']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select></Field>
      {s === 'received' && !restocked && <Toggle name="restock" defaultChecked label="Return items to stock" />}
      <Field label="Internal note"><textarea name="admin_note" defaultValue={note ?? ''} className="input !min-h-[70px]" /></Field>
      <Toggle name="notify" defaultChecked label="Email the customer" />
      <Submit>Update return</Submit>
    </ActionForm>
  );
}
