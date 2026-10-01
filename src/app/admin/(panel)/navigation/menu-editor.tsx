'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUp, ArrowDown, Trash2, Plus, ChevronRight, ImageIcon } from 'lucide-react';
import { MediaPicker, adminToast } from '@/components/admin/client';
import { saveMenu } from './actions';
import { cn } from '@/lib/utils';

type Item = { label: string; href: string; children?: Item[]; feature?: { title?: string; href?: string; image?: string } | null; auto?: string | null; highlight?: boolean };

function moveIn<T>(arr: T[], i: number, d: number) { const c = [...arr]; const j = i + d; if (j < 0 || j >= c.length) return c; [c[i], c[j]] = [c[j], c[i]]; return c; }

export function MenuEditor({ menuKey, name, initial, nested }: { menuKey: string; name: string; initial: Item[]; nested: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>(initial);
  const [open, setOpen] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [picker, setPicker] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const set = (fn: (x: Item[]) => Item[]) => { setItems(fn); setDirty(true); };
  const patch = (i: number, p: Partial<Item>) => set((x) => x.map((it, n) => (n === i ? { ...it, ...p } : it)));
  const save = () => start(async () => { const r = await saveMenu(menuKey, items); if (r?.error) adminToast(r.error, 'error'); else { adminToast('Menu saved'); setDirty(false); router.refresh(); } });

  return (
    <div className="max-w-4xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="font-display text-[24px]">{name}</p>
        <div className="flex items-center gap-3">{dirty && <span className="text-[12px] text-sale">Unsaved changes</span>}<button type="button" onClick={save} disabled={pending || !dirty} className="btn btn-primary btn-sm">{pending ? 'Saving…' : 'Save menu'}</button></div>
      </div>
      <ol className="space-y-2">
        {items.map((it, i) => (
          <li key={i} className="border border-line bg-surface">
            <div className="flex flex-wrap items-center gap-2 p-3">
              {nested && <button type="button" onClick={() => setOpen(open === i ? null : i)} aria-label="Expand" aria-expanded={open === i} className="grid h-8 w-8 place-items-center"><ChevronRight size={15} className={cn('transition-transform', open === i && 'rotate-90')} /></button>}
              <input value={it.label} onChange={(e) => patch(i, { label: e.target.value })} className="input !min-h-[38px] w-44 !text-[13px]" placeholder="Label" aria-label="Label" />
              <input value={it.href} onChange={(e) => patch(i, { href: e.target.value })} className="input !min-h-[38px] min-w-[180px] flex-1 !text-[13px]" placeholder="/collections/new-arrivals" aria-label="Link" />
              {nested && it.children?.length ? <span className="text-[12px] text-muted">{it.children.length} links</span> : null}
              <span className="ml-auto flex">
                <Btn label="Move up" onClick={() => set((x) => moveIn(x, i, -1))}><ArrowUp size={13} /></Btn>
                <Btn label="Move down" onClick={() => set((x) => moveIn(x, i, 1))}><ArrowDown size={13} /></Btn>
                <Btn label="Remove" onClick={() => set((x) => x.filter((_, n) => n !== i))} danger><Trash2 size={13} /></Btn>
              </span>
            </div>
            {nested && open === i && (
              <div className="grid gap-5 border-t border-line bg-bg/50 p-4">
                <label className="grid gap-1 text-[13px]"><span className="text-[11px] uppercase tracking-[0.12em] text-muted">Dropdown type</span>
                  <select value={it.auto ?? ''} onChange={(e) => patch(i, { auto: e.target.value || null })} className="input !min-h-[38px] max-w-xs !text-[13px]"><option value="">Custom links</option><option value="texture">Automatic — all textures</option><option value="length">Automatic — all lengths</option></select>
                </label>
                {!it.auto && (
                  <div>
                    <p className="mb-2 text-[11px] uppercase tracking-[0.12em] text-muted">Dropdown links</p>
                    <ol className="space-y-1.5">
                      {(it.children ?? []).map((c, j) => (
                        <li key={j} className="flex flex-wrap items-center gap-2">
                          <input value={c.label} onChange={(e) => patch(i, { children: it.children!.map((x, n) => (n === j ? { ...x, label: e.target.value } : x)) })} className="input !min-h-[36px] w-44 !text-[13px]" placeholder="Label" aria-label="Link label" />
                          <input value={c.href} onChange={(e) => patch(i, { children: it.children!.map((x, n) => (n === j ? { ...x, href: e.target.value } : x)) })} className="input !min-h-[36px] min-w-[160px] flex-1 !text-[13px]" placeholder="/hair/bundles" aria-label="Link URL" />
                          <Btn label="Move up" onClick={() => patch(i, { children: moveIn(it.children!, j, -1) })}><ArrowUp size={13} /></Btn>
                          <Btn label="Move down" onClick={() => patch(i, { children: moveIn(it.children!, j, 1) })}><ArrowDown size={13} /></Btn>
                          <Btn label="Remove" danger onClick={() => patch(i, { children: it.children!.filter((_, n) => n !== j) })}><Trash2 size={13} /></Btn>
                        </li>
                      ))}
                    </ol>
                    <button type="button" onClick={() => patch(i, { children: [...(it.children ?? []), { label: '', href: '' }] })} className="btn btn-outline btn-sm mt-2"><Plus size={13} /> Add link</button>
                  </div>
                )}
                <div>
                  <p className="mb-2 text-[11px] uppercase tracking-[0.12em] text-muted">Featured tile (optional)</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => setPicker(i)} className="grid h-14 w-14 place-items-center overflow-hidden border border-line bg-panel" aria-label="Choose image">{it.feature?.image ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={it.feature.image} alt="" className="h-full w-full object-cover" /> : <ImageIcon size={16} />}</button>
                    <input value={it.feature?.title ?? ''} onChange={(e) => patch(i, { feature: { ...it.feature, title: e.target.value } })} className="input !min-h-[36px] w-48 !text-[13px]" placeholder="Title" aria-label="Feature title" />
                    <input value={it.feature?.href ?? ''} onChange={(e) => patch(i, { feature: { ...it.feature, href: e.target.value } })} className="input !min-h-[36px] min-w-[160px] flex-1 !text-[13px]" placeholder="Link" aria-label="Feature link" />
                    {it.feature && <button type="button" onClick={() => patch(i, { feature: null })} className="text-[12px] text-muted underline">Remove</button>}
                  </div>
                </div>
              </div>
            )}
          </li>
        ))}
      </ol>
      <button type="button" onClick={() => set((x) => [...x, { label: '', href: '' }])} className="btn btn-outline btn-sm mt-3"><Plus size={13} /> Add {nested ? 'menu item' : 'link'}</button>
      <MediaPicker open={picker !== null} onClose={() => setPicker(null)} kind="image" onPick={(p) => { if (picker !== null && p[0]) patch(picker, { feature: { ...items[picker].feature, image: p[0].url } }); }} />
    </div>
  );
}

function Btn({ label, onClick, children, danger }: { label: string; onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return <button type="button" onClick={onClick} aria-label={label} title={label} className={cn('grid h-8 w-8 place-items-center border border-line bg-surface', danger && 'text-sale')}>{children}</button>;
}
