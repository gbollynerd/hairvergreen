'use client';
import { useState } from 'react';
import type { ResourceDef, FieldDef, OptionSource } from '@/lib/admin/resources';
import { ActionForm, Submit, Field, MoneyInput, Toggle, TagsInput, MediaField, ListEditor, type ActionResult } from '@/components/admin/client';
import { RichText } from '@/components/admin/rich-text';
import { slugify, titleCase, formatDateTime, cn } from '@/lib/utils';

const toLocal = (iso?: string | null) => { if (!iso) return ''; const d = new Date(iso); const off = d.getTimezoneOffset(); return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16); };

export function ResourceForm({ def, row, options, media, action }: {
  def: ResourceDef; row: Record<string, any>; options: Partial<Record<OptionSource, [string, string][]>>; media: Record<string, string>;
  action: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
}) {
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(def.fields.map((f) => [f.name, row[f.name] == null ? '' : String(row[f.name])])));
  const visible = (f: FieldDef) => !f.showIf || f.showIf.in.includes(vals[f.showIf.field] ?? '');
  const sections: { name: string; fields: FieldDef[] }[] = [];
  for (const f of def.fields) {
    const name = f.section ?? sections[sections.length - 1]?.name ?? 'Details';
    let s = sections.find((x) => x.name === name);
    if (!s) { s = { name, fields: [] }; sections.push(s); }
    s.fields.push(f);
  }
  return (
    <ActionForm action={action} className="space-y-6">
      {sections.map((s) => (
        <section key={s.name} className="border border-line bg-surface p-5">
          <p className="mb-4 text-[12px] font-medium uppercase tracking-[0.16em]">{s.name}</p>
          <div className="grid gap-5 md:grid-cols-2">
            {s.fields.map((f) => (
              <div key={f.name} className={cn(f.span === 2 && 'md:col-span-2', !visible(f) && 'hidden')}>
                <FieldInput f={f} row={row} options={f.options ?? (f.optionsFrom ? options[f.optionsFrom] ?? [] : [])} media={media}
                  onValue={(v) => setVals((x) => ({ ...x, [f.name]: v }))} value={vals[f.name]} disabled={!visible(f)} />
              </div>
            ))}
          </div>
        </section>
      ))}
      <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t border-line bg-[#f3f0e8]/95 px-4 py-3 md:-mx-8 md:px-8"><Submit>Save {def.singular}</Submit></div>
    </ActionForm>
  );
}

function FieldInput({ f, row, options, media, onValue, value, disabled }: { f: FieldDef; row: Record<string, any>; options: [string, string][]; media: Record<string, string>; onValue: (v: string) => void; value: string; disabled: boolean }) {
  const v = row[f.name];
  const common = { name: disabled ? undefined : f.name, required: f.required && !disabled, placeholder: f.placeholder };
  switch (f.type) {
    case 'readonly':
      return <Field label={f.label}><div className="min-h-[42px] whitespace-pre-wrap border border-line bg-bg px-3 py-2 text-[14px]">{v == null || v === '' ? '—' : typeof v === 'object' ? Object.entries(v).map(([k, x]) => `${titleCase(k)}: ${Array.isArray(x) ? x.join(', ') : String(x)}`).join('\n') : /^\d{4}-\d{2}-\d{2}T/.test(String(v)) ? formatDateTime(v) : String(v)}</div></Field>;
    case 'textarea': return <Field label={f.label} hint={f.hint}><textarea {...common} defaultValue={v ?? ''} className="input !min-h-[90px]" /></Field>;
    case 'richtext': return <Field label={f.label} hint={f.hint}><RichText name={common.name} defaultValue={v ?? ''} /></Field>;
    case 'number': return <Field label={f.label} hint={f.hint}><input type="number" step="any" {...common} defaultValue={v ?? ''} onChange={(e) => onValue(e.target.value)} className="input" /></Field>;
    case 'money': return <Field label={`${f.label} (₦)`} hint={f.hint}>{disabled ? <input className="input" disabled /> : <MoneyInput name={f.name} defaultValue={v} required={f.required} />}</Field>;
    case 'boolean': return <div className="pt-6"><Toggle name={common.name} defaultChecked={!!v} label={f.label} onChange={(x) => onValue(String(x))} />{f.hint && <p className="mt-1 text-[12px] text-muted">{f.hint}</p>}</div>;
    case 'select': return (
      <Field label={f.label} hint={f.hint}><select {...common} value={value} onChange={(e) => onValue(e.target.value)} className="input">
        {!f.required && <option value="">—</option>}{options.map(([o, l]) => <option key={o} value={o}>{l}</option>)}</select></Field>);
    case 'multiselect': return <Field label={f.label} hint={f.hint}><MultiSelect name={common.name} options={options} defaultValue={Array.isArray(v) ? v : []} /></Field>;
    case 'date': return <Field label={f.label} hint={f.hint}><input type="date" {...common} defaultValue={v ? String(v).slice(0, 10) : ''} className="input" /></Field>;
    case 'datetime': return <Field label={f.label} hint={f.hint ?? 'Your local time'}><input type="datetime-local" {...common} defaultValue={toLocal(v)} className="input" /></Field>;
    case 'tags': return <Field label={f.label} hint={f.hint}>{common.name ? <TagsInput name={common.name} defaultValue={Array.isArray(v) ? v : []} /> : <input className="input" disabled />}</Field>;
    case 'emails': return <Field label={f.label} hint="Separate with commas"><textarea {...common} defaultValue={v ?? ''} className="input !min-h-[70px]" /></Field>;
    case 'media': return <Field label={f.label} hint={f.hint}>{common.name && <MediaField name={common.name} defaultUrl={v} />}</Field>;
    case 'mediaId': return <Field label={f.label} hint={f.hint}>{common.name && <MediaIdField name={common.name} id={v} url={v ? media[v] : null} />}</Field>;
    case 'list': return <Field label={f.label} hint={f.hint}>{common.name && <ListEditor name={common.name} defaultValue={Array.isArray(v) ? v : []} fields={f.listFields ?? []} />}</Field>;
    case 'color': return <Field label={f.label} hint={f.hint}><div className="flex gap-2"><input type="color" defaultValue={v || '#0F3D2E'} onChange={(e) => onValue(e.target.value)} className="h-[42px] w-14 border border-line" aria-label={f.label} /><input {...common} value={value} onChange={(e) => onValue(e.target.value)} className="input" placeholder="#0F3D2E" /></div></Field>;
    case 'slug': return <Field label={f.label} hint={f.hint}><input {...common} defaultValue={v ?? ''} onBlur={(e) => { e.currentTarget.value = slugify(e.currentTarget.value); }} className="input" /></Field>;
    default: return <Field label={f.label} hint={f.hint}><input {...common} defaultValue={v ?? ''} onChange={(e) => onValue(e.target.value)} className="input" /></Field>;
  }
}

function MultiSelect({ name, options, defaultValue }: { name?: string; options: [string, string][]; defaultValue: string[] }) {
  const [sel, setSel] = useState<string[]>(defaultValue);
  const [q, setQ] = useState('');
  const shown = options.filter(([, l]) => !q || l.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="border border-line bg-surface">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search… (${sel.length} selected)`} className="w-full border-b border-line px-3 py-2 text-[13px] outline-none" />
      <ul className="max-h-56 overflow-y-auto p-1">{shown.map(([id, l]) => (
        <li key={id}><label className="flex cursor-pointer items-center gap-2 px-2 py-1 text-[13px] hover:bg-bg"><input type="checkbox" checked={sel.includes(id)} onChange={() => setSel((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id])} />{l}</label></li>
      ))}</ul>
      {name && <input type="hidden" name={name} value={JSON.stringify(sel)} />}
    </div>
  );
}

function MediaIdField({ name, id, url }: { name: string; id: string | null; url: string | null }) {
  return <MediaField name={`${name}__url`} idName={name} defaultUrl={url} defaultId={id} />;
}
