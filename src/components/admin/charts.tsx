'use client';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

// Single-series charts only (no dual axes). Mark colour validated for chroma/contrast on the light surface.
const MARK = '#1E7A54';
const GRID = '#E3D9C4';
const INK = '#6B665C';
const ngn = (v: number) => `₦${(v / 100).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
const short = (v: number) => { const n = v / 100; return n >= 1e6 ? `₦${(n / 1e6).toFixed(1)}m` : n >= 1e3 ? `₦${Math.round(n / 1e3)}k` : `₦${n}`; };
const day = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

function Tip({ active, payload, label, money }: { active?: boolean; payload?: { value: number }[]; label?: string; money?: boolean }) {
  if (!active || !payload?.length) return null;
  return <div className="border border-line bg-surface px-3 py-2 text-[12px] shadow-md"><p className="text-muted">{label ? day(label) : ''}</p><p className="font-medium tabular-nums">{money ? ngn(payload[0].value) : payload[0].value.toLocaleString()}</p></div>;
}

export function TimeChart({ data, dataKey, money = true, kind = 'area', label }: { data: Record<string, any>[]; dataKey: string; money?: boolean; kind?: 'area' | 'bar'; label: string }) {
  const empty = !data.some((d) => Number(d[dataKey]) !== 0);
  return (
    <figure className="h-[240px] w-full" aria-label={label}>
      {empty ? <div className="grid h-full place-items-center text-[13px] text-muted">No data for this period yet</div> : (
        <ResponsiveContainer width="100%" height="100%">
          {kind === 'area' ? (
            <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs><linearGradient id={`g-${dataKey}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={MARK} stopOpacity={0.22} /><stop offset="100%" stopColor={MARK} stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid stroke={GRID} strokeDasharray="0" vertical={false} />
              <XAxis dataKey="bucket" tickFormatter={day} tick={{ fontSize: 11, fill: INK }} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis tickFormatter={money ? short : undefined} tick={{ fontSize: 11, fill: INK }} axisLine={false} tickLine={false} width={56} />
              <Tooltip content={<Tip money={money} />} cursor={{ stroke: INK, strokeDasharray: '3 3' }} />
              <Area type="monotone" dataKey={dataKey} stroke={MARK} strokeWidth={2} fill={`url(#g-${dataKey})`} activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2 }} />
            </AreaChart>
          ) : (
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="bucket" tickFormatter={day} tick={{ fontSize: 11, fill: INK }} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis allowDecimals={false} tickFormatter={money ? short : undefined} tick={{ fontSize: 11, fill: INK }} axisLine={false} tickLine={false} width={56} />
              <Tooltip content={<Tip money={money} />} cursor={{ fill: 'rgba(15,61,46,0.05)' }} />
              <Bar dataKey={dataKey} fill={MARK} radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          )}
        </ResponsiveContainer>
      )}
    </figure>
  );
}

/** Ranked horizontal bars with the value always written as text (colour is never the only cue). */
export function BarList({ rows, money = true }: { rows: { label: string; value: number; sub?: string }[]; money?: boolean }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="py-6 text-center text-[13px] text-muted">No data for this period yet</p>;
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} className="text-[13px]">
          <div className="flex justify-between gap-3"><span className="truncate">{r.label}</span><span className="shrink-0 tabular-nums">{money ? ngn(r.value) : r.value.toLocaleString()}{r.sub && <span className="ml-2 text-muted">{r.sub}</span>}</span></div>
          <div className="mt-1 h-[6px] bg-bg"><div className="h-full rounded-r-[3px]" style={{ width: `${(r.value / max) * 100}%`, background: MARK }} /></div>
        </li>
      ))}
    </ul>
  );
}
