'use client';
import { useState } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import type { CustomUnitConfig } from '@/lib/commerce/custom-unit';

export function ColorField({ name, label, defaultValue }: { name: string; label: string; defaultValue: string }) {
  const [v, setV] = useState(defaultValue);
  const valid = /^#[0-9a-fA-F]{6}$/.test(v);
  return (
    <label className="flex items-center gap-3 text-[13px]">
      <input type="color" value={valid ? v : '#000000'} onChange={(e) => setV(e.target.value.toUpperCase())} className="h-9 w-12 cursor-pointer border border-line bg-surface p-0.5" aria-label={`${label} colour picker`} />
      <span className="min-w-0 flex-1"><span className="block">{label}</span>
        <input name={name} value={v} onChange={(e) => setV(e.target.value)} className={`w-28 border-b bg-transparent font-mono text-[12px] outline-none ${valid ? 'border-line' : 'border-sale'}`} aria-label={`${label} hex value`} />
      </span>
    </label>
  );
}

type Group = CustomUnitConfig['groups'][number];

export function CustomUnitEditor({ initial }: { initial: CustomUnitConfig }) {
  const [cfg, setCfg] = useState<CustomUnitConfig>(initial);
  const setGroup = (i: number, g: Partial<Group>) => setCfg((c) => ({ ...c, groups: c.groups.map((x, n) => (n === i ? { ...x, ...g } : x)) }));
  const moveG = (i: number, d: number) => setCfg((c) => { const g = [...c.groups]; const j = i + d; if (j < 0 || j >= g.length) return c; [g[i], g[j]] = [g[j], g[i]]; return { ...c, groups: g }; });
  const naira = (k: number) => (k / 100).toString();
  return (
    <div className="grid gap-5">
      <input type="hidden" name="config" value={JSON.stringify(cfg)} />
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-1.5 text-[13px]"><span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Base length included (inches)</span><input type="number" value={cfg.base_length} onChange={(e) => setCfg({ ...cfg, base_length: Number(e.target.value) })} className="input max-w-[140px]" /></label>
        <label className="grid gap-1.5 text-[13px]"><span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Price per extra inch (₦)</span><input inputMode="decimal" value={naira(cfg.per_inch)} onChange={(e) => setCfg({ ...cfg, per_inch: Math.round(Number(e.target.value.replace(/[^0-9.]/g, '')) * 100) || 0 })} className="input max-w-[180px]" /></label>
      </div>
      {cfg.groups.map((g, i) => (
        <div key={i} className="border border-line bg-bg/50 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input value={g.label} onChange={(e) => setGroup(i, { label: e.target.value })} className="input !min-h-[38px] w-48 font-medium !text-[14px]" aria-label="Group label" />
            <input value={g.key} onChange={(e) => setGroup(i, { key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })} className="input !min-h-[38px] w-32 font-mono !text-[12px]" aria-label="Group key" title="Internal key" />
            <label className="flex items-center gap-1.5 text-[12px]"><input type="checkbox" checked={!!g.required} onChange={(e) => setGroup(i, { required: e.target.checked })} /> Required</label>
            <label className="flex items-center gap-1.5 text-[12px]"><input type="checkbox" checked={!!g.multiple} onChange={(e) => setGroup(i, { multiple: e.target.checked })} /> Multiple choice</label>
            <span className="ml-auto flex gap-1">
              <button type="button" onClick={() => moveG(i, -1)} aria-label="Move group up" className="grid h-8 w-8 place-items-center border border-line"><ArrowUp size={13} /></button>
              <button type="button" onClick={() => moveG(i, 1)} aria-label="Move group down" className="grid h-8 w-8 place-items-center border border-line"><ArrowDown size={13} /></button>
              <button type="button" onClick={() => { if (window.confirm(`Remove the “${g.label}” group?`)) setCfg((c) => ({ ...c, groups: c.groups.filter((_, n) => n !== i) })); }} aria-label="Remove group" className="grid h-8 w-8 place-items-center border border-line text-sale"><Trash2 size={13} /></button>
            </span>
          </div>
          <table className="w-full text-[13px]">
            <thead><tr className="text-left text-[11px] uppercase tracking-[0.12em] text-muted"><th className="pb-1 font-medium">Option</th><th className="pb-1 font-medium">Value</th><th className="pb-1 font-medium">Surcharge (₦)</th><th className="pb-1 font-medium" title="Order needs staff review before production">Review</th><th /></tr></thead>
            <tbody>
              {g.options.map((o, j) => {
                const setO = (p: Partial<typeof o>) => setGroup(i, { options: g.options.map((x, n) => (n === j ? { ...x, ...p } : x)) });
                return (
                  <tr key={j}>
                    <td className="py-1 pr-2"><input value={o.label} onChange={(e) => setO({ label: e.target.value })} className="input !min-h-[34px] !py-1 !text-[13px]" aria-label="Option label" /></td>
                    <td className="py-1 pr-2"><input value={o.value} onChange={(e) => setO({ value: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })} className="input !min-h-[34px] w-28 !py-1 font-mono !text-[12px]" aria-label="Option value" /></td>
                    <td className="py-1 pr-2"><input inputMode="decimal" value={naira(o.price)} onChange={(e) => setO({ price: Math.round(Number(e.target.value.replace(/[^0-9.]/g, '')) * 100) || 0 })} className="input !min-h-[34px] w-32 !py-1 !text-[13px]" aria-label="Surcharge" /></td>
                    <td className="py-1 pr-2"><input type="checkbox" checked={!!o.review} onChange={(e) => setO({ review: e.target.checked })} aria-label="Requires review" /></td>
                    <td className="py-1"><button type="button" onClick={() => setGroup(i, { options: g.options.filter((_, n) => n !== j) })} aria-label="Remove option" className="text-sale"><Trash2 size={13} /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <button type="button" onClick={() => setGroup(i, { options: [...g.options, { value: '', label: '', price: 0 }] })} className="mt-2 text-[12px] underline"><Plus size={12} className="inline" /> Add option</button>
        </div>
      ))}
      <button type="button" onClick={() => setCfg((c) => ({ ...c, groups: [...c.groups, { key: `group_${c.groups.length + 1}`, label: 'New group', options: [] }] }))} className="btn btn-outline btn-sm justify-self-start"><Plus size={13} /> Add option group</button>
    </div>
  );
}
