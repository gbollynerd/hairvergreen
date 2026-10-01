'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Folder, FolderPlus, Upload, X, Video, FileIcon } from 'lucide-react';
import { TagsInput, adminToast, uploadToLibrary, uploadVideoPoster, CopyText } from '@/components/admin/client';
import { updateMedia, deleteMedia, moveMedia, replaceMediaFile, createFolder, renameFolder, deleteFolder, mediaUsage, setVideoPoster } from './actions';
import { cn } from '@/lib/utils';

type Item = { id: string; url: string; alt: string; title: string | null; filename: string | null; kind: string; mime_type: string | null; width: number | null; height: number | null; size_bytes: number | null; tags: string[] | null; folder_id: string | null; created_at: string; metadata?: { poster?: string | null } | null };
type FolderT = { id: string; name: string; parent_id: string | null };

const fmtSize = (b?: number | null) => (!b ? '—' : b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1e3)} KB`);

export function MediaLibrary({ items, total, page, perPage, folders, tags, filters, canDelete }: {
  items: Item[]; total: number; page: number; perPage: number; folders: FolderT[]; tags: string[];
  filters: { folder: string; q: string; kind: string; tag: string }; canDelete: boolean;
}) {
  const router = useRouter();
  const [sel, setSel] = useState<string[]>([]);
  const [active, setActive] = useState<Item | null>(null);
  const [uploading, setUploading] = useState(0);
  const [drag, setDrag] = useState(false);
  const [pending, start] = useTransition();
  const qs = (p: Partial<typeof filters & { page: string }>) => `/admin/media?${new URLSearchParams(Object.entries({ ...filters, page: '1', ...p }).filter(([, v]) => v) as [string, string][])}`;
  useEffect(() => { setSel([]); setActive((a) => (a ? items.find((i) => i.id === a.id) ?? null : null)); }, [items]);

  const run = (fn: () => Promise<{ error?: string; message?: string; redirect?: string } | null>) => start(async () => {
    const r = await fn();
    if (r?.error) adminToast(r.error, 'error'); else { if (r?.message) adminToast(r.message); if (r?.redirect) router.push(r.redirect); else router.refresh(); }
  });

  const upload = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;
    setUploading(list.length);
    let ok = 0;
    for (const f of list) {
      try { await uploadToLibrary(f, filters.folder && filters.folder !== 'none' ? filters.folder : null); ok++; } catch (e) { adminToast(`${f.name}: ${e instanceof Error ? e.message : 'failed'}`, 'error'); }
      setUploading((n) => n - 1);
    }
    if (ok) adminToast(`Uploaded ${ok} file${ok > 1 ? 's' : ''}`);
    router.refresh();
  };

  const currentFolder = folders.find((f) => f.id === filters.folder);
  const pages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <aside className="space-y-1 text-[13px]">
        <FolderLink href={qs({ folder: '' })} active={!filters.folder} label="All files" />
        <FolderLink href={qs({ folder: 'none' })} active={filters.folder === 'none'} label="Unfiled" />
        {folders.map((f) => <FolderLink key={f.id} href={qs({ folder: f.id })} active={filters.folder === f.id} label={f.name} />)}
        <button type="button" disabled={pending} onClick={() => { const n = window.prompt('Folder name'); if (n) run(() => createFolder(n)); }} className="mt-2 flex items-center gap-2 px-3 py-2 text-muted hover:text-ink"><FolderPlus size={15} /> New folder</button>
        {currentFolder && (
          <div className="mt-4 flex gap-3 border-t border-line px-3 pt-3 text-[12px]">
            <button type="button" className="underline" onClick={() => { const n = window.prompt('Rename folder', currentFolder.name); if (n) run(() => renameFolder(currentFolder.id, n)); }}>Rename</button>
            {canDelete && <button type="button" className="text-sale underline" onClick={() => { if (window.confirm('Delete this folder? Files inside are kept.')) run(() => deleteFolder(currentFolder.id)); }}>Delete folder</button>}
          </div>
        )}
      </aside>

      <div className="min-w-0">
        <form className="mb-4 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); router.push(qs({ q: String(f.get('q') || ''), kind: String(f.get('kind') || ''), tag: String(f.get('tag') || '') })); }}>
          <input name="q" defaultValue={filters.q} placeholder="Search name or alt text" className="input !min-h-[38px] max-w-xs flex-1 !text-[13px]" aria-label="Search media" />
          <select name="kind" defaultValue={filters.kind} className="input !min-h-[38px] !w-auto !text-[13px]" aria-label="Type"><option value="">All types</option><option value="image">Images</option><option value="video">Videos</option></select>
          {tags.length > 0 && <select name="tag" defaultValue={filters.tag} className="input !min-h-[38px] !w-auto !text-[13px]" aria-label="Tag"><option value="">All tags</option>{tags.map((t) => <option key={t} value={t}>{t}</option>)}</select>}
          <button className="btn btn-outline btn-sm">Filter</button>
          <label className="btn btn-primary btn-sm ml-auto cursor-pointer"><Upload size={14} /> {uploading ? `Uploading ${uploading}…` : 'Upload'}<input type="file" multiple accept="image/*,video/*" className="sr-only" onChange={(e) => { if (e.target.files) upload(e.target.files); e.target.value = ''; }} /></label>
        </form>

        {sel.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-3 border border-primary bg-surface px-4 py-2.5 text-[13px]">
            <span>{sel.length} selected</span>
            <select className="input !min-h-[34px] !w-auto !py-0 !text-[13px]" defaultValue="" onChange={(e) => { const v = e.target.value; e.target.value = ''; if (v) run(() => moveMedia(sel, v === 'none' ? null : v)); }} aria-label="Move to folder">
              <option value="" disabled>Move to…</option><option value="none">Unfiled</option>{folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            {canDelete && <button type="button" className="text-sale underline" onClick={() => { if (window.confirm(`Delete ${sel.length} file(s)? Files in use will be blocked.`)) run(() => deleteMedia(sel)); }}>Delete</button>}
            <button type="button" className="ml-auto text-muted underline" onClick={() => setSel([])}>Clear</button>
          </div>
        )}

        <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files); }}
          className={cn('grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-7', drag && 'outline-dashed outline-2 outline-primary')}>
          {items.map((m) => {
            const on = sel.includes(m.id);
            return (
              <div key={m.id} className={cn('group relative aspect-square overflow-hidden border bg-panel', active?.id === m.id ? 'border-primary' : 'border-line')}>
                <button type="button" onClick={() => setActive(m)} className="h-full w-full" aria-label={`Edit ${m.title || m.filename}`}>
                  {m.kind === 'video' ? <span className="relative block h-full w-full">{m.metadata?.poster ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={m.metadata.poster} alt={m.alt} loading="lazy" className="h-full w-full object-cover" /> : <video src={`${m.url}#t=0.5`} muted preload="metadata" className="h-full w-full object-cover" />}<span className="absolute bottom-1 right-1 grid h-6 w-6 place-items-center bg-primary/80 text-primary-contrast"><Video size={12} /></span></span> : m.kind === 'file' ? <span className="grid h-full w-full place-items-center"><FileIcon size={22} /></span> : /* eslint-disable-next-line @next/next/no-img-element */ <img src={m.url} alt={m.alt} loading="lazy" className="h-full w-full object-cover" />}
                </button>
                <button type="button" onClick={() => setSel(on ? sel.filter((x) => x !== m.id) : [...sel, m.id])} aria-label={on ? 'Deselect' : 'Select'} aria-pressed={on}
                  className={cn('absolute left-1.5 top-1.5 grid h-6 w-6 place-items-center border bg-surface', on ? 'border-primary bg-primary text-primary-contrast' : 'border-line opacity-0 group-hover:opacity-100 focus:opacity-100')}>{on && <Check size={13} />}</button>
                {!m.alt && <span className="absolute bottom-1 left-1 bg-sale px-1.5 text-[10px] text-white">No alt</span>}
              </div>
            );
          })}
        </div>
        {!items.length && <div className="border border-dashed border-line bg-surface p-14 text-center text-[14px] text-muted">No files here. Drag files onto this area or use Upload.</div>}
        {pages > 1 && (
          <nav className="mt-4 flex items-center justify-between text-[13px]" aria-label="Pagination">
            <span className="text-muted">Page {page} of {pages} · {total} files</span>
            <div className="flex gap-2">{page > 1 && <Link href={qs({ page: String(page - 1) })} className="btn btn-outline btn-sm">Previous</Link>}{page < pages && <Link href={qs({ page: String(page + 1) })} className="btn btn-outline btn-sm">Next</Link>}</div>
          </nav>
        )}
      </div>

      {active && <Details key={active.id} m={active} folders={folders} canDelete={canDelete} onClose={() => setActive(null)} run={run} pending={pending} />}
    </div>
  );
}

function FolderLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return <Link href={href} className={cn('flex items-center gap-2 px-3 py-2', active ? 'bg-surface font-medium text-ink ring-1 ring-line' : 'text-muted hover:text-ink')}><Folder size={15} strokeWidth={1.4} />{label}</Link>;
}

function Details({ m, folders, canDelete, onClose, run, pending }: { m: Item; folders: FolderT[]; canDelete: boolean; onClose: () => void; run: (fn: () => Promise<any>) => void; pending: boolean }) {
  const [alt, setAlt] = useState(m.alt ?? '');
  const [title, setTitle] = useState(m.title ?? '');
  const [tags, setTags] = useState<string[]>(m.tags ?? []);
  const [folder, setFolder] = useState(m.folder_id ?? '');
  const [usage, setUsage] = useState<{ label: string; count: number }[] | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [thumbBusy, setThumbBusy] = useState(false);
  useEffect(() => { mediaUsage(m.id).then(setUsage); }, [m.id]);

  const replace = async (file?: File) => {
    if (!file) return;
    setReplacing(true);
    try {
      const dims = await new Promise<{ width?: number; height?: number }>((res) => { if (!file.type.startsWith('image/')) return res({}); const i = new Image(); i.onload = () => res({ width: i.naturalWidth, height: i.naturalHeight }); i.onerror = () => res({}); i.src = URL.createObjectURL(file); });
      const s = await fetch('/api/admin/media/sign', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size }) });
      const sd = await s.json(); if (!s.ok) throw new Error(sd.error || 'Upload failed');
      const { supabaseBrowser } = await import('@/lib/supabase/client');
      const { error } = await supabaseBrowser().storage.from('media').uploadToSignedUrl(sd.path, sd.token, file, { contentType: file.type });
      if (error) throw new Error(error.message);
      const poster = file.type.startsWith('video/') ? await uploadVideoPoster(file, file.name) : null;
      run(() => replaceMediaFile(m.id, { path: sd.path, mime_type: file.type, size_bytes: file.size, filename: file.name, ...dims, ...(poster ? { poster_path: poster.poster_path, width: poster.width, height: poster.height, duration_seconds: poster.duration } : {}) }));
    } catch (e) { adminToast(e instanceof Error ? e.message : 'Replace failed', 'error'); }
    setReplacing(false);
  };

  return (
    <div className="fixed inset-y-0 right-0 z-[80] w-full max-w-md overflow-y-auto border-l border-line bg-surface p-6 shadow-2xl" role="dialog" aria-label="Media details">
      <div className="mb-4 flex items-center justify-between"><p className="font-display text-[22px]">File details</p><button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center"><X size={18} /></button></div>
      <div className="mb-4 grid aspect-[4/3] place-items-center overflow-hidden bg-panel">
        {m.kind === 'video' ? <video src={m.url} poster={m.metadata?.poster ?? undefined} controls preload="metadata" className="h-full w-full object-contain" /> : /* eslint-disable-next-line @next/next/no-img-element */ <img src={m.url} alt={m.alt} className="h-full w-full object-contain" />}
      </div>
      <dl className="mb-5 grid grid-cols-[90px_1fr] gap-y-1 text-[12px]">
        <dt className="text-muted">File</dt><dd className="truncate">{m.filename}</dd>
        <dt className="text-muted">Type</dt><dd>{m.mime_type}</dd>
        {m.width && <><dt className="text-muted">Size</dt><dd>{m.width} × {m.height} · {fmtSize(m.size_bytes)}</dd></>}
        <dt className="text-muted">URL</dt><dd className="flex gap-2"><span className="truncate">{m.url}</span><CopyText text={m.url} /></dd>
        <dt className="text-muted">Used in</dt><dd>{usage === null ? '…' : usage.length ? usage.map((u) => `${u.count} ${u.label}`).join(', ') : 'Not used anywhere'}</dd>
      </dl>
      <div className="grid gap-4">
        <label className="grid gap-1.5"><span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Alt text</span><textarea value={alt} onChange={(e) => setAlt(e.target.value)} className="input !min-h-[70px]" placeholder="Describe what the image shows" /></label>
        <label className="grid gap-1.5"><span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Title</span><input value={title} onChange={(e) => setTitle(e.target.value)} className="input" /></label>
        <div className="grid gap-1.5"><span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Tags</span><TagsInput name="_tags" defaultValue={tags} onChange={setTags} /></div>
        <label className="grid gap-1.5"><span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Folder</span><select value={folder} onChange={(e) => setFolder(e.target.value)} className="input"><option value="">Unfiled</option>{folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
        <button type="button" disabled={pending} onClick={() => run(() => updateMedia(m.id, { alt, title, tags, folder_id: folder || null }))} className="btn btn-primary btn-sm">{pending ? 'Saving…' : 'Save details'}</button>
        {m.kind === 'video' && (
          <div className="grid gap-2 border-t border-line pt-4">
            <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Thumbnail</span>
            <div className="flex items-center gap-3">
              <span className="grid h-20 w-16 shrink-0 place-items-center overflow-hidden bg-panel">{m.metadata?.poster ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={m.metadata.poster} alt="" className="h-full w-full object-cover" /> : <span className="px-1 text-center text-[10px] text-muted">None yet</span>}</span>
              <div className="flex flex-col items-start gap-1.5">
                <button type="button" disabled={thumbBusy} className="btn btn-outline btn-sm" onClick={async () => {
                  setThumbBusy(true);
                  const p = await uploadVideoPoster(m.url, m.filename || 'video');
                  if (p) run(() => setVideoPoster(m.id, p.poster_path, { width: p.width, height: p.height, duration_seconds: p.duration }));
                  else adminToast('Could not read a frame from this video. Upload a thumbnail image instead.', 'error');
                  setThumbBusy(false);
                }}>{thumbBusy ? 'Working…' : m.metadata?.poster ? 'Re-create from video' : 'Create from video'}</button>
                <label className="cursor-pointer text-[12px] underline">Upload an image instead<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={async (e) => {
                  const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
                  setThumbBusy(true);
                  try {
                    const s = await fetch('/api/admin/media/sign', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ filename: f.name, contentType: f.type, size: f.size }) });
                    const sd = await s.json(); if (!s.ok) throw new Error(sd.error || 'Upload failed');
                    const { supabaseBrowser } = await import('@/lib/supabase/client');
                    const { error } = await supabaseBrowser().storage.from('media').uploadToSignedUrl(sd.path, sd.token, f, { contentType: f.type });
                    if (error) throw new Error(error.message);
                    run(() => setVideoPoster(m.id, sd.path));
                  } catch (err) { adminToast(err instanceof Error ? err.message : 'Upload failed', 'error'); }
                  setThumbBusy(false);
                }} /></label>
              </div>
            </div>
            <p className="text-[12px] text-muted">Shown on product cards and in the gallery until the video plays.</p>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <label className="btn btn-outline btn-sm cursor-pointer">{replacing ? 'Uploading…' : 'Replace file'}<input type="file" accept="image/*,video/*" className="sr-only" onChange={(e) => replace(e.target.files?.[0])} /></label>
          {canDelete && <button type="button" className="text-[13px] text-sale underline" onClick={() => {
            const used = usage && usage.length;
            if (!window.confirm(used ? 'This file is in use. Deleting it will leave gaps where it appears. Delete anyway?' : 'Delete this file permanently?')) return;
            run(() => deleteMedia([m.id], !!used)); onClose();
          }}>Delete</button>}
        </div>
        <p className="text-[12px] text-muted">Replacing keeps every link to this file working — products, pages and posts update automatically.</p>
      </div>
    </div>
  );
}
