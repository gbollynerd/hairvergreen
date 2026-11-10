'use client';

import { useEffect, useRef, useState } from 'react';
import { Share2, Link2, Mail, Check } from 'lucide-react';
import { WhatsAppIcon } from '@/components/ui/icons';
import { useStore } from './store-provider';
import { track } from '@/lib/analytics-client';
import { cn } from '@/lib/utils';

const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden><path d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.5V4.4c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.4H8v3h2.6V21h2.9Z" /></svg>
);
const XIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden><path d="M17.8 3h3.1l-6.8 7.8L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L2 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z" /></svg>
);
const PinterestIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden><path d="M12 2a10 10 0 0 0-3.6 19.3c-.1-.8-.2-2 0-2.9l1.2-5s-.3-.6-.3-1.5c0-1.4.8-2.5 1.8-2.5.9 0 1.3.7 1.3 1.4 0 .9-.6 2.2-.9 3.4-.2 1 .5 1.9 1.6 1.9 1.9 0 3.3-2 3.3-4.9 0-2.6-1.8-4.4-4.5-4.4-3 0-4.8 2.3-4.8 4.6 0 .9.4 1.9.8 2.4l.1.4-.3 1.2c0 .2-.2.3-.4.2-1.3-.6-2.2-2.6-2.2-4.2 0-3.4 2.5-6.6 7.2-6.6 3.8 0 6.7 2.7 6.7 6.3 0 3.8-2.4 6.8-5.7 6.8-1.1 0-2.2-.6-2.5-1.3l-.7 2.6c-.2.9-.9 2.1-1.4 2.8A10 10 0 1 0 12 2Z" /></svg>
);

/**
 * Share a page. On phones this opens the device's own share sheet (Instagram, WhatsApp, Messages…);
 * elsewhere it shows a small menu with copy-link and the main networks.
 */
export function ShareButton({ title, text, path, image, className }: { title: string; text?: string; path: string; image?: string | null; className?: string }) {
  const { toast } = useStore();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const url = () => `${window.location.origin}${path}`;
  const done = (method: string) => { track('share', { method, path }); setOpen(false); };

  const onShare = async () => {
    const touch = window.matchMedia('(pointer: coarse)').matches;
    if (touch && typeof navigator.share === 'function') {
      try { await navigator.share({ title, text: text || title, url: url() }); track('share', { method: 'native', path }); return; }
      catch (e) { if ((e as DOMException)?.name === 'AbortError') return; }
    }
    setOpen((v) => !v);
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(url()); setCopied(true); toast('Link copied'); setTimeout(() => setCopied(false), 1800); }
    catch { toast('Could not copy the link', 'error'); }
    done('copy');
  };

  const enc = encodeURIComponent;
  const links = () => {
    const u = url(); const t = text ? `${title} — ${text}` : title;
    const img = image ? (image.startsWith('http') ? image : `${window.location.origin}${image}`) : '';
    return [
      { id: 'whatsapp', label: 'WhatsApp', icon: <WhatsAppIcon width={16} height={16} />, href: `https://wa.me/?text=${enc(`${t} ${u}`)}` },
      { id: 'facebook', label: 'Facebook', icon: <FacebookIcon />, href: `https://www.facebook.com/sharer/sharer.php?u=${enc(u)}` },
      { id: 'x', label: 'X', icon: <XIcon />, href: `https://x.com/intent/post?text=${enc(t)}&url=${enc(u)}` },
      { id: 'pinterest', label: 'Pinterest', icon: <PinterestIcon />, href: `https://www.pinterest.com/pin/create/button/?url=${enc(u)}&description=${enc(t)}${img ? `&media=${enc(img)}` : ''}` },
      { id: 'email', label: 'Email', icon: <Mail size={16} strokeWidth={1.4} />, href: `mailto:?subject=${enc(title)}&body=${enc(`${t}\n\n${u}`)}` },
    ];
  };

  return (
    <div ref={box} className={cn('relative', className)}>
      <button type="button" onClick={onShare} aria-haspopup="menu" aria-expanded={open} className="inline-flex items-center gap-2 transition-opacity hover:opacity-80">
        <Share2 size={17} strokeWidth={1.3} /><span className="caps">Share</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-2 w-52 border border-line bg-surface py-1 shadow-[0_8px_30px_rgba(15,61,46,0.12)] animate-fade-in">
          <button type="button" role="menuitem" onClick={copy} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[14px] hover:bg-panel">
            {copied ? <Check size={16} strokeWidth={1.6} /> : <Link2 size={16} strokeWidth={1.4} />}{copied ? 'Copied' : 'Copy link'}
          </button>
          {links().map((l) => (
            <a key={l.id} role="menuitem" href={l.href} target={l.id === 'email' ? undefined : '_blank'} rel="noopener noreferrer" onClick={() => done(l.id)}
              className="flex items-center gap-3 px-4 py-2.5 text-[14px] hover:bg-panel">
              {l.icon}{l.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
