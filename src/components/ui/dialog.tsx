'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Accessible overlay used for drawers, sheets and modals: focus trap, Esc to close,
 * returns focus to the trigger, aria-modal, click-outside to dismiss.
 */
export function Dialog({ open, onClose, label, children, variant = 'modal', className, hideClose }: {
  open: boolean; onClose: () => void; label: string; children: ReactNode; variant?: 'modal' | 'drawer-right' | 'drawer-left' | 'sheet' | 'full';
  className?: string; hideClose?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<Element | null>(null);
  useEffect(() => {
    if (!open) return;
    lastFocus.current = document.activeElement;
    const el = panel.current;
    const focusables = () => el ? Array.from(el.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])')).filter((x) => x.offsetParent !== null) : [];
    setTimeout(() => (el?.querySelector<HTMLElement>('[data-autofocus]') ?? focusables()[0] ?? el)?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key === 'Tab') {
        const f = focusables(); if (!f.length) return;
        const first = f[0]; const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); (lastFocus.current as HTMLElement | null)?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  const pos = {
    modal: 'items-center justify-center p-4',
    'drawer-right': 'justify-end',
    'drawer-left': 'justify-start',
    sheet: 'items-end',
    full: '',
  }[variant];
  const anim = {
    modal: 'animate-scale-in max-h-[92vh] w-full max-w-3xl overflow-auto',
    'drawer-right': 'animate-drawer-right h-full w-full max-w-[440px] overflow-hidden flex flex-col',
    'drawer-left': 'animate-drawer-left h-full w-[88vw] max-w-[400px] overflow-auto',
    sheet: 'animate-sheet w-full max-h-[88vh] overflow-auto',
    full: 'animate-fade-in h-full w-full overflow-auto',
  }[variant];
  return (
    <div className={cn('fixed inset-0 z-[80] flex', pos)} role="presentation">
      <div className="absolute inset-0 bg-[#0b1f18]/45 backdrop-blur-[2px] animate-fade-in" onClick={onClose} aria-hidden />
      <div ref={panel} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} className={cn('relative bg-surface text-ink shadow-2xl outline-none', anim, className)}>
        {!hideClose && (
          <button type="button" onClick={onClose} className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center hover:opacity-70" aria-label="Close">
            <X size={20} strokeWidth={1.4} />
          </button>
        )}
        {children}
      </div>
    </div>
  );
}
