import Link from 'next/link';
import { Fragment } from 'react';
import { cn } from '@/lib/utils';

// Shared admin UI primitives (server-safe). Interactive pieces live in ./client.tsx.

export function PageHeader({ title, description, actions, back }: { title: string; description?: React.ReactNode; actions?: React.ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-end md:justify-between">
      <div>
        {back && <Link href={back.href} className="mb-2 inline-block text-[12px] text-muted hover:text-ink">← {back.label}</Link>}
        <h1 className="font-display text-[28px] leading-tight sm:text-[34px]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-[14px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, actions, children, className, padded = true }: { title?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string; padded?: boolean }) {
  return (
    <section className={cn('min-w-0 border border-line bg-surface', className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
          {title && <h2 className="text-[12px] font-medium uppercase tracking-[0.16em]">{title}</h2>}
          {actions}
        </div>
      )}
      <div className={cn(padded && 'p-4 sm:p-5')}>{children}</div>
    </section>
  );
}

const TONES: Record<string, string> = {
  green: 'bg-[#e3efe8] text-[#0f5132]', gold: 'bg-[#f5ecd8] text-[#7a5a1e]', red: 'bg-[#f6e0e0] text-[#8a2e2e]', gray: 'bg-[#eceae4] text-[#55524a]',
  blue: 'bg-[#e1eaf5] text-[#1f4b7a]', purple: 'bg-[#ece4f3] text-[#553278]',
};
export function Badge({ children, tone = 'gray' }: { children: React.ReactNode; tone?: keyof typeof TONES | string }) {
  return <span className={cn('inline-flex items-center whitespace-nowrap px-2 py-0.5 text-[11px] font-medium', TONES[tone] ?? TONES.gray)}>{children}</span>;
}

export const ORDER_TONE: Record<string, string> = {
  pending_payment: 'gold', paid: 'blue', payment_failed: 'red', processing: 'purple', ready_for_shipment: 'purple', shipped: 'blue', delivered: 'green',
  cancelled: 'gray', refund_requested: 'gold', refunded: 'gray', partially_refunded: 'gold',
};

export function StatCard({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: 'up' | 'down' | 'neutral' }) {
  return (
    <div className="border border-line bg-surface p-5">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-2 font-display text-[30px] leading-none tabular-nums">{value}</p>
      {sub && <p className={cn('mt-2 text-[12px]', tone === 'up' ? 'text-[#0f5132]' : tone === 'down' ? 'text-sale' : 'text-muted')}>{sub}</p>}
    </div>
  );
}

export function Table({ head, children, empty, className }: { head: React.ReactNode[]; children: React.ReactNode; empty?: React.ReactNode; className?: string }) {
  const hasRows = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <div className={cn('overflow-x-auto border border-line bg-surface', className)}>
      <table className="w-full min-w-[640px] text-left text-[13px]">
        <thead className="border-b border-line bg-bg/60"><tr>{head.map((h, i) => <th key={i} scope="col" className="whitespace-nowrap px-4 py-3 text-[11px] font-medium uppercase tracking-[0.12em] text-muted">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-line">{hasRows ? children : <tr><td colSpan={head.length} className="px-4 py-12 text-center text-muted">{empty ?? 'Nothing here yet.'}</td></tr>}</tbody>
      </table>
    </div>
  );
}
export const Td = ({ children, className, ...rest }: React.TdHTMLAttributes<HTMLTableCellElement>) => <td className={cn('px-4 py-3 align-middle', className)} {...rest}>{children}</td>;

export function Pagination({ page, total, perPage, href }: { page: number; total: number; perPage: number; href: (p: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  if (pages <= 1) return null;
  return (
    <nav className="mt-4 flex items-center justify-between text-[13px]" aria-label="Pagination">
      <span className="text-muted">Page {page} of {pages} · {total} total</span>
      <div className="flex gap-2">
        {page > 1 && <Link href={href(page - 1)} className="btn btn-outline btn-sm">Previous</Link>}
        {page < pages && <Link href={href(page + 1)} className="btn btn-outline btn-sm">Next</Link>}
      </div>
    </nav>
  );
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: React.ReactNode }) {
  return <div className="border border-dashed border-line bg-surface px-6 py-14 text-center"><p className="font-display text-[22px]">{title}</p>{text && <p className="mt-1 text-[14px] text-muted">{text}</p>}{action && <div className="mt-5">{action}</div>}</div>;
}

export function DefinitionList({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-2 text-[13px]">
      {items.filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => <Fragment key={k}><dt className="text-muted">{k}</dt><dd>{v}</dd></Fragment>)}
    </dl>
  );
}

export function FilterBar({ children }: { children: React.ReactNode }) {
  return <form className="mb-5 flex flex-wrap items-end gap-3" method="get">{children}</form>;
}
export function FilterSelect({ name, label, value, options }: { name: string; label: string; value?: string; options: [string, string][] }) {
  return (
    <label className="grid min-w-0 flex-1 gap-1 text-[11px] uppercase tracking-[0.12em] text-muted sm:flex-none">{label}
      <select name={name} defaultValue={value ?? ''} className="input !min-h-[38px] w-full !py-1 !text-[13px] normal-case tracking-normal sm:w-auto sm:max-w-[240px]"><option value="">All</option>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
    </label>
  );
}
export function FilterInput({ name, label, value, type = 'text', placeholder }: { name: string; label: string; value?: string; type?: string; placeholder?: string }) {
  return (
    <label className="grid min-w-0 flex-1 basis-full gap-1 text-[11px] uppercase tracking-[0.12em] text-muted sm:basis-auto sm:flex-none">{label}
      <input name={name} type={type} defaultValue={value ?? ''} placeholder={placeholder} className="input !min-h-[38px] !py-1 !text-[13px] normal-case tracking-normal" />
    </label>
  );
}
