'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { formatMoney, type DisplayCurrency } from '@/lib/money';
import { track } from '@/lib/analytics-client';
import type { CartView } from '@/lib/commerce/cart';

type Toast = { id: number; message: string; tone?: 'default' | 'error' };
type AddInput = { product_id: string; variant_id: string; quantity?: number; bundle_selection?: Record<string, string> | null; customization?: Record<string, unknown> | null; name?: string; price?: number };

type StoreCtx = {
  cart: CartView | null; cartLoading: boolean; cartOpen: boolean; setCartOpen: (v: boolean) => void;
  addToCart: (i: AddInput) => Promise<boolean>; cartAction: (body: Record<string, unknown>) => Promise<(CartView & { error?: string; message?: string }) | null>;
  refreshCart: () => Promise<void>;
  wishlist: string[]; toggleWishlist: (productId: string, name?: string) => Promise<void>; inWishlist: (id: string) => boolean;
  user: { id: string; email: string } | null;
  currency: DisplayCurrency; currencies: DisplayCurrency[]; setCurrency: (code: string) => void; money: (minor: number | null | undefined) => string;
  searchOpen: boolean; setSearchOpen: (v: boolean) => void; menuOpen: boolean; setMenuOpen: (v: boolean) => void;
  quickView: string | null; setQuickView: (slug: string | null) => void;
  toast: (message: string, tone?: Toast['tone']) => void; toasts: Toast[];
};

const Ctx = createContext<StoreCtx | null>(null);
export const useStore = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useStore must be used inside StoreProvider');
  return c;
};

const WL_KEY = 'hg_wishlist';
const CUR_KEY = 'hg_currency';
const safeGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const safeSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } };

export function StoreProvider({ children, currencies }: { children: React.ReactNode; currencies: DisplayCurrency[] }) {
  const [cart, setCart] = useState<CartView | null>(null);
  const [cartLoading, setCartLoading] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [currencyCode, setCurrencyCode] = useState('NGN');
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [quickView, setQuickView] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const toast = useCallback((message: string, tone: Toast['tone'] = 'default') => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);

  const refreshCart = useCallback(async () => {
    try {
      const r = await fetch('/api/cart', { cache: 'no-store' });
      if (r.ok) setCart(await r.json());
    } catch { /* offline */ }
  }, []);

  const cartAction = useCallback(async (body: Record<string, unknown>) => {
    setCartLoading(true);
    try {
      const r = await fetch('/api/cart', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const data = await r.json();
      if (data && Array.isArray(data.lines)) setCart(data);
      if (!r.ok || data.error) { toast(data.error || 'Something went wrong', 'error'); return { ...data, error: data.error || 'error' }; }
      return data;
    } catch {
      toast('Connection problem — please try again', 'error');
      return null;
    } finally {
      setCartLoading(false);
    }
  }, [toast]);

  const addToCart = useCallback(async (i: AddInput) => {
    const res = await cartAction({ action: 'add', product_id: i.product_id, variant_id: i.variant_id, quantity: i.quantity ?? 1, bundle_selection: i.bundle_selection ?? null, customization: i.customization ?? null });
    if (res && !res.error) {
      setCartOpen(true);
      track('add_to_cart', { product_id: i.product_id, variant_id: i.variant_id, value: i.price, quantity: i.quantity ?? 1, name: i.name });
      return true;
    }
    return false;
  }, [cartAction]);

  // Auth state + wishlist sync
  useEffect(() => {
    const sb = supabaseBrowser();
    const load = async (u: { id: string; email?: string } | null) => {
      setUser(u ? { id: u.id, email: u.email ?? '' } : null);
      const local: string[] = JSON.parse(safeGet(WL_KEY) || '[]');
      if (u) {
        if (local.length) {
          await fetch('/api/wishlist', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'merge', product_ids: local }) });
          safeSet(WL_KEY, '[]');
        }
        const r = await fetch('/api/wishlist', { cache: 'no-store' });
        if (r.ok) setWishlist((await r.json()).product_ids ?? []);
      } else setWishlist(local);
    };
    sb.auth.getSession().then(({ data }) => load(data.session?.user ?? null));
    const { data: sub } = sb.auth.onAuthStateChange((evt, session) => {
      if (evt === 'SIGNED_IN' || evt === 'SIGNED_OUT') { load(session?.user ?? null); refreshCart(); }
    });
    return () => sub.subscription.unsubscribe();
  }, [refreshCart]);

  useEffect(() => { refreshCart(); }, [refreshCart]);
  useEffect(() => { const c = safeGet(CUR_KEY); if (c) setCurrencyCode(c); }, []);

  const toggleWishlist = useCallback(async (productId: string, name?: string) => {
    const has = wishlist.includes(productId);
    const next = has ? wishlist.filter((x) => x !== productId) : [...wishlist, productId];
    setWishlist(next);
    if (user) {
      const r = await fetch('/api/wishlist', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: has ? 'remove' : 'add', product_id: productId }) });
      if (!r.ok) { setWishlist(wishlist); toast('Could not update your wishlist', 'error'); return; }
    } else safeSet(WL_KEY, JSON.stringify(next));
    if (!has) track('add_to_wishlist', { product_id: productId, name });
    toast(has ? 'Removed from your wishlist' : 'Saved to your wishlist');
  }, [wishlist, user, toast]);

  const currency = currencies.find((c) => c.code === currencyCode) ?? currencies[0] ?? { code: 'NGN', symbol: '₦', rate: 1 };
  const setCurrency = useCallback((code: string) => { setCurrencyCode(code); safeSet(CUR_KEY, code); }, []);
  const money = useCallback((m: number | null | undefined) => formatMoney(m, currency), [currency]);

  useEffect(() => {
    const lock = cartOpen || menuOpen || searchOpen || !!quickView;
    document.documentElement.style.overflow = lock ? 'hidden' : '';
  }, [cartOpen, menuOpen, searchOpen, quickView]);

  const value = useMemo<StoreCtx>(() => ({
    cart, cartLoading, cartOpen, setCartOpen, addToCart, cartAction, refreshCart,
    wishlist, toggleWishlist, inWishlist: (id: string) => wishlist.includes(id), user,
    currency, currencies, setCurrency, money,
    searchOpen, setSearchOpen, menuOpen, setMenuOpen, quickView, setQuickView, toast, toasts,
  }), [cart, cartLoading, cartOpen, addToCart, cartAction, refreshCart, wishlist, toggleWishlist, user, currency, currencies, setCurrency, money, searchOpen, menuOpen, quickView, toast, toasts]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
