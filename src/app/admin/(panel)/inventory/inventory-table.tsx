'use client';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Table, Td } from '@/components/admin/ui';
import { adminToast } from '@/components/admin/client';
import { adjustStock, setThreshold } from './actions';

type Row = { id: string; sku: string | null; title: string; product: string; productId: string; status: string; onHand: number; reserved: number; available: number; threshold: number; backorder: boolean; restock: string | null };

export function InventoryTable({ rows, canEdit }: { rows: Row[]; canEdit: boolean }) {
  return (
    <Table head={['Product', 'Variant', 'SKU', 'On hand', 'Reserved', 'Available', 'Alert at', canEdit ? 'Adjust' : '']} empty="No variants match.">
      {rows.map((r) => <InvRow key={r.id} r={r} canEdit={canEdit} />)}
    </Table>
  );
}

function InvRow({ r, canEdit }: { r: Row; canEdit: boolean }) {
  const router = useRouter();
  const [amt, setAmt] = useState('');
  const [pending, start] = useTransition();
  const run = (mode: 'add' | 'set') => start(async () => {
    const n = Number(amt); if (!amt || isNaN(n)) return;
    const res = await adjustStock(r.id, mode, n, mode === 'add' ? 'Quick adjust' : 'Stock count');
    if (res?.error) adminToast(res.error, 'error'); else { adminToast(res?.message ?? 'Saved'); setAmt(''); router.refresh(); }
  });
  return (
    <tr className="hover:bg-bg/50">
      <Td><Link href={`/admin/products/${r.productId}`} className="underline">{r.product}</Link>{r.status !== 'active' && <span className="ml-1 text-[11px] text-muted">({r.status})</span>}</Td>
      <Td>{r.title}</Td><Td className="font-mono text-[11px]">{r.sku ?? '—'}</Td>
      <Td>{r.onHand}</Td><Td>{r.reserved || '—'}</Td>
      <Td><Badge tone={r.available <= 0 ? 'red' : r.available <= r.threshold ? 'gold' : 'green'}>{r.available <= 0 ? (r.backorder ? 'Backorder' : 'Out') : r.available}</Badge></Td>
      <Td>{canEdit ? <input type="number" defaultValue={r.threshold} onBlur={async (e) => { const n = Number(e.target.value); if (n !== r.threshold) { const x = await setThreshold(r.id, n); if (x?.error) adminToast(x.error, 'error'); } }} className="input !min-h-[32px] w-16 !py-0 !text-[13px]" aria-label="Low stock alert threshold" /> : r.threshold}</Td>
      {canEdit && (
        <Td><div className="flex items-center gap-1">
          <input value={amt} onChange={(e) => setAmt(e.target.value)} inputMode="numeric" placeholder="±/=" className="input !min-h-[32px] w-16 !py-0 !text-[13px]" aria-label="Quantity" />
          <button type="button" disabled={pending} onClick={() => run('add')} className="btn btn-outline btn-sm !min-h-[32px] !px-2" title="Add (use negative to remove)">+/−</button>
          <button type="button" disabled={pending} onClick={() => run('set')} className="btn btn-outline btn-sm !min-h-[32px] !px-2" title="Set exact count">Set</button>
        </div></Td>
      )}
    </tr>
  );
}
