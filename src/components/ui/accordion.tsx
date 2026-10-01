'use client';
import { useId, useState, type ReactNode } from 'react';
import { Plus, Minus } from 'lucide-react';

export function Accordion({ items, defaultOpen }: { items: { title: string; content: ReactNode }[]; defaultOpen?: number }) {
  const [open, setOpen] = useState<number | null>(defaultOpen ?? null);
  const id = useId();
  return (
    <div className="border-t border-line">
      {items.map((it, i) => (
        <div key={i} className="border-b border-line">
          <h3 className="font-sans">
            <button type="button" className="flex w-full items-center justify-between gap-4 py-5 text-left caps" aria-expanded={open === i}
              aria-controls={`${id}-${i}`} onClick={() => setOpen(open === i ? null : i)}>
              <span>{it.title}</span>
              {open === i ? <Minus size={16} strokeWidth={1.3} /> : <Plus size={16} strokeWidth={1.3} />}
            </button>
          </h3>
          <div id={`${id}-${i}`} role="region" hidden={open !== i} className="pb-6 text-[15px] leading-7 text-muted">
            {it.content}
          </div>
        </div>
      ))}
    </div>
  );
}
