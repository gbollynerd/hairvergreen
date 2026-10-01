'use client';
import { useState } from 'react';
import { ActionForm, Submit, Field, MoneyInput, Toggle } from '@/components/admin/client';
import { saveTracking, addOrderNote, cancelOrderAction, refundOrderAction, recordOfflinePayment } from '../actions';

export function TrackingForm({ orderId, carrier, number, url, canShip }: { orderId: string; carrier: string | null; number: string | null; url: string | null; canShip: boolean }) {
  return (
    <ActionForm action={saveTracking} className="grid gap-4 md:grid-cols-3">
      <input type="hidden" name="order_id" value={orderId} />
      <Field label="Carrier"><input name="carrier" defaultValue={carrier ?? ''} className="input" list="carriers" placeholder="DHL Express" /></Field>
      <datalist id="carriers">{['DHL Express', 'GIG Logistics', 'FedEx', 'UPS', 'Dispatch rider', 'Aramex', 'Kwik'].map((c) => <option key={c} value={c} />)}</datalist>
      <Field label="Tracking number"><input name="tracking_number" defaultValue={number ?? ''} className="input" /></Field>
      <Field label="Tracking link"><input name="tracking_url" defaultValue={url ?? ''} className="input" placeholder="https://…" /></Field>
      <div className="flex flex-wrap items-center gap-5 md:col-span-3">
        {canShip && <Toggle name="mark_shipped" defaultChecked label="Mark as shipped" />}
        <Toggle name="notify" defaultChecked label="Email the customer" />
        <Submit>Save tracking</Submit>
      </div>
    </ActionForm>
  );
}

export function NoteForm({ orderId }: { orderId: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <ActionForm action={addOrderNote} resetOnSuccess className="grid gap-3">
      <input type="hidden" name="order_id" value={orderId} />
      <textarea name="message" className="input !min-h-[70px]" placeholder={visible ? 'Message visible to the customer on their order page' : 'Internal note (staff only)'} />
      <div className="flex flex-wrap items-center gap-5"><Toggle name="visible" label="Visible to customer" onChange={setVisible} />{visible && <Toggle name="email" label="Also email it" />}<Submit>Add note</Submit></div>
    </ActionForm>
  );
}

export function CancelForm({ orderId, paid }: { orderId: string; paid: boolean }) {
  return (
    <ActionForm action={cancelOrderAction} className="grid gap-3">
      <input type="hidden" name="order_id" value={orderId} />
      <Field label="Reason"><input name="reason" className="input" placeholder="Customer request, out of stock…" /></Field>
      {paid && <Toggle name="restock" defaultChecked label="Return items to stock" />}
      <Toggle name="notify" defaultChecked label="Email the customer" />
      {paid && <p className="text-[12px] text-muted">Cancelling does not refund the payment — issue a refund separately.</p>}
      <Submit variant="outline" className="!border-sale !text-sale">Cancel order</Submit>
    </ActionForm>
  );
}

export function RefundForm({ orderId, max, items, returnId }: { orderId: string; max: number; items: { id: string; name: string; qty: number }[]; returnId?: string }) {
  const [restock, setRestock] = useState<Record<string, number>>({});
  return (
    <ActionForm action={refundOrderAction} className="grid gap-3">
      <input type="hidden" name="order_id" value={orderId} />
      {returnId && <input type="hidden" name="return_id" value={returnId} />}
      <Field label={`Amount (max ₦${(max / 100).toLocaleString('en-NG')})`}><MoneyInput name="amount" defaultValue={max} required /></Field>
      <Field label="Method"><select name="method" className="input"><option value="original_payment">Refund to original payment (Paystack)</option><option value="manual">Manual (bank transfer / cash — record only)</option><option value="store_credit">Store credit (record only)</option></select></Field>
      <Field label="Reason"><input name="reason" className="input" /></Field>
      {items.some((i) => i.qty > 0) && (
        <fieldset className="grid gap-2"><legend className="label mb-1">Restock items</legend>
          {items.filter((i) => i.qty > 0).map((i) => (
            <label key={i.id} className="flex items-center justify-between gap-3 text-[13px]"><span className="truncate">{i.name}</span>
              <select className="input !min-h-[34px] !w-20 !py-0" value={restock[i.id] ?? 0} onChange={(e) => setRestock((r) => ({ ...r, [i.id]: Number(e.target.value) }))}>
                {Array.from({ length: i.qty + 1 }, (_, n) => <option key={n} value={n}>{n}</option>)}</select></label>
          ))}
        </fieldset>
      )}
      <input type="hidden" name="restock_items" value={JSON.stringify(Object.entries(restock).map(([order_item_id, quantity]) => ({ order_item_id, quantity })))} />
      <Toggle name="notify" defaultChecked label="Email the customer" />
      <Submit>Issue refund</Submit>
    </ActionForm>
  );
}

export function OfflinePaymentForm({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" className="mt-3 text-[12px] underline" onClick={() => setOpen(true)}>Record an offline payment…</button>;
  return (
    <ActionForm action={recordOfflinePayment} className="mt-4 grid gap-3 border-t border-line pt-4">
      <input type="hidden" name="order_id" value={orderId} />
      <Field label="Channel"><select name="channel" className="input"><option value="bank_transfer">Direct bank transfer</option><option value="cash">Cash / POS in studio</option><option value="other">Other</option></select></Field>
      <Field label="Note (required)"><input name="note" required className="input" placeholder="e.g. Transfer from GTBank, ref 123…" /></Field>
      <p className="text-[12px] text-muted">Only record a payment you have confirmed in your bank account. This marks the order paid and commits stock.</p>
      <Submit>Record payment</Submit>
    </ActionForm>
  );
}
