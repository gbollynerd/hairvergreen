'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Badge, Table, Td } from '@/components/admin/ui';
import { ActionButton } from '@/components/admin/client';
import { bulkStatus } from './actions';
import { formatMoney } from '@/lib/money';
import { formatDate, titleCase } from '@/lib/utils';

type Row = { id: string; name: string; slug: string; status: string; type: string; price: number; category: string; featured: boolean; image: string | null; variants: number; stock: number; tracked: boolean; updated_at: string };
const TONE: Record<string, string> = { active: 'green', draft: 'gold', hidden: 'gray', archived: 'gray' };

export function ProductTable({ rows, canPublish }: { rows: Row[]; canPublish: boolean }) {
  const [sel, setSel] = useState<string[]>([]);
  const all = sel.length === rows.length && rows.length > 0;
  return (
    <>
      {canPublish && sel.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 bg-panel px-4 py-2 text-[13px]">
          <span>{sel.length} selected</span>
          {(['active', 'hidden', 'draft', 'archived'] as const).map((s) => <ActionButton key={s} action={async () => { const r = await bulkStatus(sel, s); setSel([]); return r; }}>{s === 'active' ? 'Publish' : titleCase(s)}</ActionButton>)}
        </div>
      )}
      <Table head={[<input key="a" type="checkbox" aria-label="Select all" checked={all} onChange={() => setSel(all ? [] : rows.map((r) => r.id))} />, '', 'Product', 'Status', 'Type', 'Category', 'Variants', 'Stock', 'From', 'Updated']} empty="No products found.">
        {rows.map((r) => (
          <tr key={r.id} className="hover:bg-bg/50">
            <Td><input type="checkbox" aria-label={`Select ${r.name}`} checked={sel.includes(r.id)} onChange={() => setSel(sel.includes(r.id) ? sel.filter((x) => x !== r.id) : [...sel, r.id])} /></Td>
            <Td>{/* eslint-disable-next-line @next/next/no-img-element */}{r.image ? <img src={r.image} alt="" className="h-12 w-10 object-cover" /> : <div className="h-12 w-10 bg-panel" />}</Td>
            <Td><Link href={`/admin/products/${r.id}`} className="font-medium underline">{r.name}</Link>{r.featured && <span className="ml-2 text-[11px] text-accent-strong">★ Featured</span>}<span className="block text-[11px] text-muted">/{r.slug}</span></Td>
            <Td><Badge tone={TONE[r.status]}>{titleCase(r.status)}</Badge></Td><Td>{titleCase(r.type)}</Td><Td>{r.category}</Td><Td>{r.variants}</Td>
            <Td>{r.tracked ? <Badge tone={r.stock <= 0 ? 'red' : r.stock <= 5 ? 'gold' : 'green'}>{r.stock}</Badge> : <span className="text-muted">—</span>}</Td>
            <Td className="tabular-nums">{formatMoney(r.price)}</Td><Td className="whitespace-nowrap text-muted">{formatDate(r.updated_at)}</Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
