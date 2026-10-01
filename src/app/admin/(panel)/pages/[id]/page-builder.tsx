'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUp, ArrowDown, Copy, Eye, EyeOff, Plus, Trash2, ImageIcon, X, GripVertical } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { ListEditor, MediaPicker, TagsInput, Toggle, adminToast } from '@/components/admin/client';
import { RichText } from '@/components/admin/rich-text';
import { SECTION_SCHEMA, SECTION_OPTIONS, COMMON_FIELDS, type SField } from '@/lib/admin/section-schema';
import { savePageSections } from '../actions';
import { cn } from '@/lib/utils';

type Sec = { key: string; id?: string; type: string; name: string; is_visible: boolean; settings: Record<string, any> };
type Opt = { slug: string; name: string };

let n = 0;
const k = () => `s${Date.now().toString(36)}${n++}`;

export function PageBuilder({ pageId, initial, collections, categories, canEdit }: {
  pageId: string; initial: Omit<Sec, 'key'>[]; collections: Opt[]; categories: Opt[]; canEdit: boolean;
}) {
  const router = useRouter();
  const [sections, setSections] = useState<Sec[]>(() => initial.map((s) => ({ ...s, key: k() })));
  const [sel, setSel] = useState<string | null>(sections[0]?.key ?? null);
  const [dirty, setDirty] = useState(false);
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const update = (fn: (s: Sec[]) => Sec[]) => { setSections(fn); setDirty(true); };
  const patch = (key: string, p: Partial<Sec>) => update((s) => s.map((x) => (x.key === key ? { ...x, ...p } : x)));
  const setSetting = (key: string, field: string, value: unknown) => update((s) => s.map((x) => (x.key === key ? { ...x, settings: { ...x.settings, [field]: value } } : x)));
  const move = (i: number, d: number) => update((s) => { const c = [...s]; const j = i + d; if (j < 0 || j >= c.length) return c; [c[i], c[j]] = [c[j], c[i]]; return c; });
  const add = (type: string) => {
    const def = SECTION_SCHEMA[type];
    const s: Sec = { key: k(), type, name: def?.label ?? type, is_visible: true, settings: structuredClone(def?.defaults ?? {}) };
    const at = sel ? sections.findIndex((x) => x.key === sel) + 1 : sections.length;
    update((c) => [...c.slice(0, at), s, ...c.slice(at)]);
    setSel(s.key); setAdding(false);
  };
  const save = () => start(async () => {
    const r = await savePageSections(pageId, sections.map(({ key: _k, ...s }) => s));
    if (r?.error) adminToast(r.error, 'error');
    else { adminToast(r?.message ?? 'Saved'); setDirty(false); router.refresh(); }
  });

  const current = sections.find((s) => s.key === sel) ?? null;

  return (
    <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
      <div>
        <div className="sticky top-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[12px] font-medium uppercase tracking-[0.16em]">Sections ({sections.length})</p>
            {canEdit && <button type="button" onClick={() => setAdding(true)} className="btn btn-outline btn-sm"><Plus size={13} /> Add</button>}
          </div>
          <ol className="space-y-1.5">
            {sections.map((s, i) => (
              <li key={s.key}>
                <div className={cn('flex items-center gap-2 border bg-surface px-2 py-2 text-[13px]', sel === s.key ? 'border-primary' : 'border-line', !s.is_visible && 'opacity-55')}>
                  <GripVertical size={14} className="shrink-0 text-muted" aria-hidden />
                  <button type="button" onClick={() => setSel(s.key)} className="min-w-0 flex-1 text-left">
                    <span className="block truncate font-medium">{s.name || SECTION_SCHEMA[s.type]?.label || s.type}</span>
                    <span className="block truncate text-[11px] text-muted">{SECTION_SCHEMA[s.type]?.label ?? s.type}{!s.is_visible && ' · hidden'}</span>
                  </button>
                  {canEdit && (
                    <span className="flex shrink-0">
                      <IconBtn label="Move up" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp size={13} /></IconBtn>
                      <IconBtn label="Move down" onClick={() => move(i, 1)} disabled={i === sections.length - 1}><ArrowDown size={13} /></IconBtn>
                      <IconBtn label={s.is_visible ? 'Hide section' : 'Show section'} onClick={() => patch(s.key, { is_visible: !s.is_visible })}>{s.is_visible ? <Eye size={13} /> : <EyeOff size={13} />}</IconBtn>
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ol>
          {!sections.length && <p className="border border-dashed border-line p-6 text-center text-[13px] text-muted">No sections yet. Add your first one.</p>}
          {canEdit && (
            <div className="flex items-center gap-3 border-t border-line pt-3">
              <button type="button" onClick={save} disabled={pending || !dirty} className="btn btn-primary btn-sm flex-1">{pending ? 'Saving…' : dirty ? 'Save sections' : 'Saved'}</button>
              {dirty && <span className="text-[12px] text-sale">Unsaved changes</span>}
            </div>
          )}
        </div>
      </div>

      <div className="min-w-0">
        {current ? (
          <SectionEditor key={current.key} sec={current} canEdit={canEdit} collections={collections} categories={categories}
            onName={(v) => patch(current.key, { name: v })} onSet={(f, v) => setSetting(current.key, f, v)}
            onReplace={(settings) => patch(current.key, { settings })}
            onDuplicate={() => { const c: Sec = { ...structuredClone(current), id: undefined, key: k(), name: `${current.name} (copy)` }; const at = sections.findIndex((x) => x.key === current.key) + 1; update((s) => [...s.slice(0, at), c, ...s.slice(at)]); setSel(c.key); }}
            onRemove={() => { if (!window.confirm('Remove this section? It is deleted when you save.')) return; const idx = sections.findIndex((x) => x.key === current.key); update((s) => s.filter((x) => x.key !== current.key)); setSel(sections[idx + 1]?.key ?? sections[idx - 1]?.key ?? null); }} />
        ) : <div className="border border-dashed border-line bg-surface p-14 text-center text-[14px] text-muted">Select a section to edit it.</div>}
      </div>

      <Dialog open={adding} onClose={() => setAdding(false)} label="Add a section" variant="modal" className="!max-w-3xl p-6">
        <p className="mb-4 pr-10 font-display text-[26px]">Add a section</p>
        <div className="grid max-h-[65vh] gap-2 overflow-y-auto sm:grid-cols-2">
          {SECTION_OPTIONS.map((o) => (
            <button key={o.type} type="button" onClick={() => add(o.type)} className="border border-line bg-surface p-4 text-left hover:border-primary">
              <span className="block text-[14px] font-medium">{o.label}</span><span className="mt-1 block text-[12px] text-muted">{o.description}</span>
            </button>
          ))}
        </div>
      </Dialog>
    </div>
  );
}

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} className="grid h-7 w-7 place-items-center text-muted hover:text-ink disabled:opacity-30">{children}</button>;
}

function SectionEditor({ sec, canEdit, collections, categories, onName, onSet, onReplace, onDuplicate, onRemove }: {
  sec: Sec; canEdit: boolean; collections: Opt[]; categories: Opt[];
  onName: (v: string) => void; onSet: (f: string, v: unknown) => void; onReplace: (s: Record<string, any>) => void; onDuplicate: () => void; onRemove: () => void;
}) {
  const schema = SECTION_SCHEMA[sec.type];
  const [tab, setTab] = useState<'content' | 'json'>(schema ? 'content' : 'json');
  const [jsonText, setJsonText] = useState('');
  useEffect(() => { if (tab === 'json') setJsonText(JSON.stringify(sec.settings, null, 2)); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps
  const fields = useMemo(() => [...(schema?.fields ?? []), ...COMMON_FIELDS], [schema]);

  return (
    <section className="border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted">{schema?.label ?? sec.type}</p>
          {schema && <p className="text-[12px] text-muted">{schema.description}</p>}
        </div>
        {canEdit && <div className="flex gap-2"><button type="button" onClick={onDuplicate} className="btn btn-outline btn-sm"><Copy size={13} /> Duplicate</button><button type="button" onClick={onRemove} className="btn btn-sm border border-sale text-sale hover:bg-sale hover:text-white"><Trash2 size={13} /> Remove</button></div>}
      </div>
      <div className="flex gap-4 border-b border-line px-5 text-[13px]">
        {(['content', 'json'] as const).map((t) => <button key={t} type="button" onClick={() => setTab(t)} className={cn('-mb-px border-b-2 py-2.5', tab === t ? 'border-primary' : 'border-transparent text-muted')}>{t === 'content' ? 'Content & style' : 'Advanced (JSON)'}</button>)}
      </div>
      <fieldset disabled={!canEdit} className="grid gap-5 p-5">
        {tab === 'content' ? (
          <>
            <Lbl label="Section name (admin only)"><input value={sec.name} onChange={(e) => onName(e.target.value)} className="input" /></Lbl>
            {fields.map((f) => <FieldInput key={f.key} f={f} value={sec.settings[f.key]} onChange={(v) => onSet(f.key, v)} collections={collections} categories={categories} sectionKey={sec.key} />)}
          </>
        ) : (
          <>
            <p className="text-[12px] text-muted">Edit the raw settings for this section. Use with care — invalid values are ignored by the storefront.</p>
            <textarea value={jsonText} onChange={(e) => setJsonText(e.target.value)} spellCheck={false} className="input min-h-[360px] font-mono !text-[12px]" aria-label="Section settings JSON" />
            <div><button type="button" className="btn btn-outline btn-sm" onClick={() => { try { const v = JSON.parse(jsonText); if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error(); onReplace(v); adminToast('Settings applied — remember to save'); } catch { adminToast('That is not valid JSON', 'error'); } }}>Apply JSON</button></div>
          </>
        )}
      </fieldset>
    </section>
  );
}

function Lbl({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <div className="grid gap-1.5"><span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">{label}</span>{children}{hint && <span className="text-[12px] text-muted">{hint}</span>}</div>;
}

const toLocal = (iso?: string) => { if (!iso) return ''; const d = new Date(iso); if (isNaN(+d)) return ''; const off = d.getTimezoneOffset(); return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16); };

function FieldInput({ f, value, onChange, collections, categories, sectionKey }: { f: SField; value: any; onChange: (v: unknown) => void; collections: Opt[]; categories: Opt[]; sectionKey: string }) {
  switch (f.type) {
    case 'text': case 'url': return <Lbl label={f.label} hint={f.hint}><input value={value ?? ''} onChange={(e) => onChange(e.target.value)} className="input" placeholder={f.placeholder} /></Lbl>;
    case 'textarea': return <Lbl label={f.label} hint={f.hint}><textarea value={value ?? ''} onChange={(e) => onChange(e.target.value)} className="input !min-h-[80px]" placeholder={f.placeholder} /></Lbl>;
    case 'number': return <Lbl label={f.label} hint={f.hint}><input type="number" step="any" value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} className="input max-w-[160px]" /></Lbl>;
    case 'datetime': return <Lbl label={f.label} hint={f.hint ?? 'Your local time'}><input type="datetime-local" value={toLocal(value)} onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : '')} className="input max-w-[260px]" /></Lbl>;
    case 'select': return <Lbl label={f.label} hint={f.hint}><select value={value ?? f.options[0]?.[0] ?? ''} onChange={(e) => onChange(e.target.value)} className="input max-w-[280px]">{f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Lbl>;
    case 'toggle': return <Toggle defaultChecked={!!value} onChange={(v) => onChange(v)} label={f.label} />;
    case 'collection': case 'category': {
      const opts = f.type === 'collection' ? collections : categories;
      return <Lbl label={f.label} hint={f.hint}><select value={value ?? ''} onChange={(e) => onChange(e.target.value)} className="input max-w-[320px]"><option value="">—</option>{opts.map((o) => <option key={o.slug} value={o.slug}>{o.name}</option>)}</select></Lbl>;
    }
    case 'tags': return <Lbl label={f.label} hint={f.hint}><TagsInput key={`${sectionKey}-${f.key}`} name={`_${f.key}`} defaultValue={Array.isArray(value) ? value : []} placeholder={f.placeholder} onChange={(t) => onChange(t)} /></Lbl>;
    case 'html': return <Lbl label={f.label} hint={f.hint}><RichText key={`${sectionKey}-${f.key}`} defaultValue={value ?? ''} onChange={(h) => onChange(h)} /></Lbl>;
    case 'list': return <Lbl label={f.label} hint={f.hint}><ListEditor key={`${sectionKey}-${f.key}`} defaultValue={Array.isArray(value) ? value : []} fields={f.fields} addLabel={f.addLabel} onChange={(rows) => onChange(rows)} /></Lbl>;
    case 'media': return <Lbl label={f.label} hint={f.hint}><MediaValue value={value} kind={f.kind} onChange={onChange} /></Lbl>;
    case 'cta': return <Lbl label={f.label} hint={f.hint}><CtaValue value={value} onChange={onChange} /></Lbl>;
    case 'ctas': {
      const list: any[] = Array.isArray(value) ? value : [];
      return (
        <Lbl label={f.label} hint={f.hint}>
          <div className="space-y-2">
            {list.map((c, i) => <div key={i} className="flex items-start gap-2"><div className="flex-1"><CtaValue value={c} withStyle onChange={(v) => onChange(list.map((x, j) => (j === i ? v : x)))} /></div><button type="button" aria-label="Remove button" onClick={() => onChange(list.filter((_, j) => j !== i))} className="grid h-10 w-10 place-items-center border border-line text-sale"><X size={14} /></button></div>)}
            {list.length < 3 && <button type="button" onClick={() => onChange([...list, { label: '', href: '', style: list.length ? 'secondary' : 'primary' }])} className="btn btn-outline btn-sm"><Plus size={13} /> Add button</button>}
          </div>
        </Lbl>
      );
    }
  }
}

function CtaValue({ value, onChange, withStyle }: { value: any; onChange: (v: unknown) => void; withStyle?: boolean }) {
  const v = value && typeof value === 'object' ? value : {};
  return (
    <div className={cn('grid gap-2', withStyle ? 'md:grid-cols-[1fr_1fr_140px]' : 'md:grid-cols-2')}>
      <input value={v.label ?? ''} onChange={(e) => onChange({ ...v, label: e.target.value })} className="input" placeholder="Button text" aria-label="Button text" />
      <input value={v.href ?? ''} onChange={(e) => onChange({ ...v, href: e.target.value })} className="input" placeholder="/collections/new-arrivals" aria-label="Button link" />
      {withStyle && <select value={v.style ?? 'primary'} onChange={(e) => onChange({ ...v, style: e.target.value })} className="input" aria-label="Button style"><option value="primary">Solid</option><option value="secondary">Outline</option></select>}
    </div>
  );
}

function MediaValue({ value, kind, onChange }: { value: any; kind?: 'image' | 'video'; onChange: (v: unknown) => void }) {
  const [open, setOpen] = useState(false);
  const v = value && typeof value === 'object' ? value : null;
  return (
    <div className="flex flex-wrap items-start gap-3">
      <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden border border-line bg-panel">
        {v?.url ? (v.kind === 'video' ? <video src={v.url} className="h-full w-full object-cover" muted /> : /* eslint-disable-next-line @next/next/no-img-element */ <img src={v.url} alt="" className="h-full w-full object-cover" />) : <ImageIcon size={20} className="text-muted" />}
      </div>
      <div className="grid min-w-[220px] flex-1 gap-2">
        <div className="flex gap-2"><button type="button" onClick={() => setOpen(true)} className="btn btn-outline btn-sm">{v?.url ? 'Change' : 'Choose from library'}</button>{v?.url && <button type="button" onClick={() => onChange(null)} className="text-[12px] text-muted underline">Remove</button>}</div>
        {v?.url && <input value={v.alt ?? ''} onChange={(e) => onChange({ ...v, alt: e.target.value })} className="input !text-[13px]" placeholder="Alt text (describe the image)" aria-label="Alt text" />}
        {v?.kind === 'video' && <input value={v.poster ?? ''} onChange={(e) => onChange({ ...v, poster: e.target.value })} className="input !text-[13px]" placeholder="Poster image URL (optional)" aria-label="Poster image" />}
      </div>
      <MediaPicker open={open} onClose={() => setOpen(false)} kind={kind} onPick={(p) => p[0] && onChange({ kind: p[0].kind === 'video' ? 'video' : 'image', url: p[0].url, alt: p[0].alt ?? '' })} />
    </div>
  );
}
