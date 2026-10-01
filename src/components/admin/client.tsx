'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { ArrowUp, ArrowDown, Trash2, Plus, ImageIcon, X, Check } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export type ActionResult = { ok?: boolean; error?: string; message?: string; id?: string; redirect?: string } | null;

// ---------------------------------------------------------------------------
// Admin toast (lightweight, independent of the storefront provider)
// ---------------------------------------------------------------------------
type T = { id: number; text: string; tone: 'ok' | 'error' };
let push: ((t: Omit<T, 'id'>) => void) | null = null;
export function adminToast(text: string, tone: 'ok' | 'error' = 'ok') { push?.({ text, tone }); }
export function AdminToaster() {
  const [items, setItems] = useState<T[]>([]);
  useEffect(() => {
    let n = 0;
    push = (t) => { const id = ++n; setItems((x) => [...x, { ...t, id }]); setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 4000); };
    return () => { push = null; };
  }, []);
  return (
    <div className="fixed bottom-5 right-5 z-[95] flex flex-col gap-2" role="status" aria-live="polite">
      {items.map((t) => <div key={t.id} className={cn('animate-fade-up px-4 py-3 text-[13px] shadow-lg', t.tone === 'error' ? 'bg-sale text-white' : 'bg-primary text-primary-contrast')}>{t.text}</div>)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Forms bound to server actions
// ---------------------------------------------------------------------------
export function ActionForm({ action, children, className, onSuccess, resetOnSuccess, refresh = true, id }: {
  action: (prev: ActionResult, fd: FormData) => Promise<ActionResult>; children: React.ReactNode; className?: string; id?: string;
  onSuccess?: (r: ActionResult) => void; resetOnSuccess?: boolean; refresh?: boolean;
}) {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(action, null);
  useEffect(() => {
    if (!state) return;
    if (state.error) adminToast(state.error, 'error');
    else if (state.ok) {
      adminToast(state.message || 'Saved');
      if (resetOnSuccess) ref.current?.reset();
      onSuccess?.(state);
      if (state.redirect) router.push(state.redirect); else if (refresh) router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  return <form ref={ref} id={id} action={formAction} className={className}>{children}</form>;
}

export function Submit({ children = 'Save', className, variant = 'primary', name, value }: { children?: React.ReactNode; className?: string; variant?: 'primary' | 'outline'; name?: string; value?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" name={name} value={value} disabled={pending} className={cn('btn btn-sm', variant === 'primary' ? 'btn-primary' : 'btn-outline', className)}>{pending ? 'Saving…' : children}</button>;
}

/** Runs a server action on click (with optional confirmation). */
export function ActionButton({ action, children, confirm: confirmText, className, variant = 'outline', disabled }: {
  action: () => Promise<ActionResult | void>; children: React.ReactNode; confirm?: string; className?: string; variant?: 'primary' | 'outline' | 'danger' | 'link'; disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const cls = variant === 'link' ? 'text-[13px] underline disabled:opacity-50' : cn('btn btn-sm', variant === 'primary' ? 'btn-primary' : variant === 'danger' ? 'border border-sale text-sale hover:bg-sale hover:text-white' : 'btn-outline');
  return (
    <button type="button" disabled={pending || disabled} className={cn(cls, className)} onClick={() => {
      if (confirmText && !window.confirm(confirmText)) return;
      start(async () => {
        const r = await action();
        if (r && r.error) adminToast(r.error, 'error');
        else { if (r && r.message) adminToast(r.message); if (r && r.redirect) router.push(r.redirect); else router.refresh(); }
      });
    }}>{pending ? '…' : children}</button>
  );
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------
export function Field({ label, hint, children, className }: { label: string; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <label className={cn('grid content-start gap-1.5', className)}><span className="label">{label}</span>{children}{hint && <span className="text-[12px] text-muted">{hint}</span>}</label>;
}

/** Naira input that submits minor units (kobo) under `name`. */
export function MoneyInput({ name, defaultValue, placeholder, required }: { name: string; defaultValue?: number | null; placeholder?: string; required?: boolean }) {
  const [v, setV] = useState(defaultValue != null ? String(defaultValue / 100) : '');
  return (
    <div className="flex items-center border border-line bg-surface focus-within:border-primary">
      <span className="pl-3 text-muted">₦</span>
      <input inputMode="decimal" value={v} required={required} placeholder={placeholder} onChange={(e) => setV(e.target.value.replace(/[^0-9.]/g, ''))} className="min-h-[42px] w-full bg-transparent px-2 text-[14px] outline-none" />
      <input type="hidden" name={name} value={v === '' ? '' : String(Math.round(Number(v) * 100))} />
    </div>
  );
}

export function Toggle({ name, defaultChecked, label, onChange }: { name?: string; defaultChecked?: boolean; label: React.ReactNode; onChange?: (v: boolean) => void }) {
  const [on, setOn] = useState(!!defaultChecked);
  return (
    <label className="flex cursor-pointer items-center gap-3 text-[14px]">
      <span className={cn('relative h-5 w-9 rounded-full transition-colors', on ? 'bg-primary' : 'bg-line')}>
        <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform', on ? 'translate-x-[18px]' : 'translate-x-0.5')} />
      </span>
      <input type="checkbox" name={name} checked={on} onChange={(e) => { setOn(e.target.checked); onChange?.(e.target.checked); }} className="sr-only" />
      {label}
    </label>
  );
}

export function TagsInput({ name, defaultValue = [], placeholder = 'Add and press Enter', onChange }: { name: string; defaultValue?: string[]; placeholder?: string; onChange?: (t: string[]) => void }) {
  const [tags, setTagsState] = useState<string[]>(defaultValue.filter(Boolean));
  const setTags = (t: string[]) => { setTagsState(t); onChange?.(t); };
  const [v, setV] = useState('');
  const add = () => { const t = v.trim(); if (t && !tags.includes(t)) setTags([...tags, t]); setV(''); };
  return (
    <div className="flex min-h-[42px] flex-wrap items-center gap-1.5 border border-line bg-surface px-2 py-1.5 focus-within:border-primary">
      {tags.map((t) => <span key={t} className="inline-flex items-center gap-1 bg-panel px-2 py-0.5 text-[12px]">{t}<button type="button" onClick={() => setTags(tags.filter((x) => x !== t))} aria-label={`Remove ${t}`}><X size={11} /></button></span>)}
      <input value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } }} onBlur={add} placeholder={placeholder} className="min-w-[120px] flex-1 bg-transparent text-[13px] outline-none" />
      <input type="hidden" name={name} value={JSON.stringify(tags)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Media picker (reads the library through /api/admin/media)
// ---------------------------------------------------------------------------
export type PickedMedia = { id: string; url: string; alt: string; kind: string };

export function MediaPicker({ open, onClose, onPick, multiple, kind }: { open: boolean; onClose: () => void; onPick: (m: PickedMedia[]) => void; multiple?: boolean; kind?: 'image' | 'video' }) {
  const [items, setItems] = useState<PickedMedia[]>([]);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const load = async () => {
    const r = await fetch(`/api/admin/media?q=${encodeURIComponent(q)}${kind ? `&kind=${kind}` : ''}`);
    if (r.ok) setItems((await r.json()).items);
  };
  useEffect(() => { if (open) { setSel([]); load(); } // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, q]);
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try { for (const f of Array.from(files)) await uploadToLibrary(f); await load(); adminToast('Uploaded'); } catch (e) { adminToast(e instanceof Error ? e.message : 'Upload failed', 'error'); }
    setUploading(false);
  };
  return (
    <Dialog open={open} onClose={onClose} label="Media library" variant="modal" className="!max-w-5xl p-5">
      <div className="mb-4 flex flex-wrap items-center gap-3 pr-10">
        <p className="font-display text-[24px]">Media library</p>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="input !min-h-[38px] max-w-xs flex-1" />
        <label className="btn btn-outline btn-sm cursor-pointer">{uploading ? 'Uploading…' : 'Upload'}<input type="file" multiple className="sr-only" accept="image/*,video/*" onChange={(e) => upload(e.target.files)} /></label>
      </div>
      <div className="grid max-h-[60vh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-5 lg:grid-cols-6">
        {items.map((m) => {
          const on = sel.includes(m.id);
          return (
            <button key={m.id} type="button" onClick={() => setSel(multiple ? (on ? sel.filter((x) => x !== m.id) : [...sel, m.id]) : [m.id])}
              className={cn('relative aspect-square overflow-hidden bg-panel ring-offset-2', on && 'ring-2 ring-primary')} title={m.alt}>
              {m.kind === 'video' ? <video src={m.url} className="h-full w-full object-cover" muted /> : /* eslint-disable-next-line @next/next/no-img-element */ <img src={m.url} alt={m.alt} className="h-full w-full object-cover" loading="lazy" />}
              {on && <span className="absolute right-1 top-1 grid h-6 w-6 place-items-center bg-primary text-primary-contrast"><Check size={14} /></span>}
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="btn btn-outline btn-sm">Cancel</button>
        <button type="button" disabled={!sel.length} onClick={() => { onPick(items.filter((m) => sel.includes(m.id))); onClose(); }} className="btn btn-primary btn-sm">Use {sel.length > 1 ? `${sel.length} items` : 'selected'}</button>
      </div>
    </Dialog>
  );
}

/** Upload a file into the public media library (signed upload, then register the row). */
export async function uploadToLibrary(file: File, folderId?: string | null): Promise<PickedMedia> {
  const dims = await new Promise<{ width?: number; height?: number }>((res) => {
    if (!file.type.startsWith('image/')) return res({});
    const img = new Image(); img.onload = () => res({ width: img.naturalWidth, height: img.naturalHeight }); img.onerror = () => res({}); img.src = URL.createObjectURL(file);
  });
  const s = await fetch('/api/admin/media/sign', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size }) });
  const sd = await s.json(); if (!s.ok) throw new Error(sd.error || 'Upload failed');
  const { supabaseBrowser } = await import('@/lib/supabase/client');
  const { error } = await supabaseBrowser().storage.from('media').uploadToSignedUrl(sd.path, sd.token, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);
  const r = await fetch('/api/admin/media', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path: sd.path, filename: file.name, mime_type: file.type, size_bytes: file.size, folder_id: folderId ?? null, ...dims }) });
  const rd = await r.json(); if (!r.ok) throw new Error(rd.error || 'Could not save');
  return rd.item;
}

/** Single media field: shows preview and a picker; submits the URL (and id) as hidden inputs. */
export function MediaField({ name, idName, defaultUrl, defaultId, kind }: { name: string; idName?: string; defaultUrl?: string | null; defaultId?: string | null; kind?: 'image' | 'video' }) {
  const [open, setOpen] = useState(false);
  const [m, setM] = useState<{ url: string; id: string | null } | null>(defaultUrl ? { url: defaultUrl, id: defaultId ?? null } : null);
  return (
    <div className="flex items-center gap-3">
      <div className="relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden border border-line bg-panel">
        {m?.url ? (/\.(mp4|webm|mov)$/i.test(m.url) ? <video src={m.url} className="h-full w-full object-cover" muted /> : /* eslint-disable-next-line @next/next/no-img-element */ <img src={m.url} alt="" className="h-full w-full object-cover" />) : <ImageIcon size={20} className="text-muted" />}
      </div>
      <div className="flex flex-col gap-1.5">
        <button type="button" onClick={() => setOpen(true)} className="btn btn-outline btn-sm">{m ? 'Change' : 'Choose'}</button>
        {m && <button type="button" onClick={() => setM(null)} className="text-left text-[12px] text-muted underline">Remove</button>}
      </div>
      <input type="hidden" name={name} value={m?.url ?? ''} />
      {idName && <input type="hidden" name={idName} value={m?.id ?? ''} />}
      <MediaPicker open={open} onClose={() => setOpen(false)} kind={kind} onPick={(p) => p[0] && setM({ url: p[0].url, id: p[0].id })} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Repeatable list editor (for FAQs, steps, menu items, value props…)
// ---------------------------------------------------------------------------
export type ListFieldDef = { key: string; label: string; type?: 'text' | 'textarea' | 'media' | 'select' | 'number'; options?: [string, string][]; placeholder?: string; wide?: boolean };

export function ListEditor({ name, defaultValue = [], fields, addLabel = 'Add item', max = 50, onChange }: { name?: string; defaultValue?: Record<string, any>[]; fields: ListFieldDef[]; addLabel?: string; max?: number; onChange?: (rows: Record<string, any>[]) => void }) {
  const [rows, setRows] = useState<Record<string, any>[]>(defaultValue);
  const last = useRef(JSON.stringify(defaultValue));
  useEffect(() => { const j = JSON.stringify(rows); if (j === last.current) return; last.current = j; onChange?.(rows); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);
  const [picker, setPicker] = useState<{ row: number; key: string } | null>(null);
  const set = (i: number, k: string, v: unknown) => setRows((r) => r.map((x, n) => (n === i ? { ...x, [k]: v } : x)));
  const move = (i: number, d: number) => setRows((r) => { const c = [...r]; const j = i + d; if (j < 0 || j >= c.length) return c; [c[i], c[j]] = [c[j], c[i]]; return c; });
  return (
    <div className="space-y-3">
      {name && <input type="hidden" name={name} value={JSON.stringify(rows)} />}
      {rows.map((row, i) => (
        <div key={i} className="grid gap-3 border border-line bg-bg/50 p-3 md:grid-cols-[1fr_auto]">
          <div className="grid gap-3 md:grid-cols-2">
            {fields.map((f) => (
              <label key={f.key} className={cn('grid gap-1', (f.wide || f.type === 'textarea') && 'md:col-span-2')}>
                <span className="text-[11px] uppercase tracking-[0.12em] text-muted">{f.label}</span>
                {f.type === 'textarea' ? <textarea value={row[f.key] ?? ''} onChange={(e) => set(i, f.key, e.target.value)} className="input !min-h-[70px] !text-[13px]" placeholder={f.placeholder} />
                  : f.type === 'select' ? <select value={row[f.key] ?? ''} onChange={(e) => set(i, f.key, e.target.value)} className="input !min-h-[38px] !py-1 !text-[13px]">{f.options?.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                  : f.type === 'media' ? (
                    <div className="flex items-center gap-2">
                      {row[f.key] && /* eslint-disable-next-line @next/next/no-img-element */ <img src={row[f.key]} alt="" className="h-10 w-10 object-cover" />}
                      <input value={row[f.key] ?? ''} onChange={(e) => set(i, f.key, e.target.value)} className="input !min-h-[38px] !py-1 !text-[13px] flex-1" placeholder="Image URL" />
                      <button type="button" className="btn btn-outline btn-sm !px-2" onClick={() => setPicker({ row: i, key: f.key })}><ImageIcon size={14} /></button>
                    </div>)
                  : <input type={f.type === 'number' ? 'number' : 'text'} value={row[f.key] ?? ''} onChange={(e) => set(i, f.key, f.type === 'number' ? Number(e.target.value) : e.target.value)} className="input !min-h-[38px] !py-1 !text-[13px]" placeholder={f.placeholder} />}
              </label>
            ))}
          </div>
          <div className="flex gap-1 md:flex-col">
            <button type="button" onClick={() => move(i, -1)} className="grid h-8 w-8 place-items-center border border-line" aria-label="Move up"><ArrowUp size={13} /></button>
            <button type="button" onClick={() => move(i, 1)} className="grid h-8 w-8 place-items-center border border-line" aria-label="Move down"><ArrowDown size={13} /></button>
            <button type="button" onClick={() => setRows(rows.filter((_, n) => n !== i))} className="grid h-8 w-8 place-items-center border border-line text-sale" aria-label="Remove"><Trash2 size={13} /></button>
          </div>
        </div>
      ))}
      {rows.length < max && <button type="button" onClick={() => setRows([...rows, {}])} className="btn btn-outline btn-sm"><Plus size={13} /> {addLabel}</button>}
      <MediaPicker open={!!picker} onClose={() => setPicker(null)} onPick={(p) => { if (picker && p[0]) set(picker.row, picker.key, p[0].url); }} />
    </div>
  );
}

export function CopyText({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return <button type="button" className="text-[12px] underline" onClick={() => { navigator.clipboard?.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }}>{done ? 'Copied' : label}</button>;
}
