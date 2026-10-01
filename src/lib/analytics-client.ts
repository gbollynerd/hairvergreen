'use client';

// Sends events to the internal funnel (/api/track) and to GA4 / Meta Pixel / TikTok Pixel when configured.
type Props = Record<string, unknown> & { product_id?: string; value?: number };

declare global {
  interface Window { gtag?: (...a: unknown[]) => void; fbq?: (...a: unknown[]) => void; ttq?: { track: (...a: unknown[]) => void; page: () => void } }
}

function sessionId() {
  try {
    let id = sessionStorage.getItem('hg_sid');
    if (!id) { id = crypto.randomUUID(); sessionStorage.setItem('hg_sid', id); }
    return id;
  } catch { return 'anon'; }
}

const GA_MAP: Record<string, string> = { view_item: 'view_item', add_to_cart: 'add_to_cart', begin_checkout: 'begin_checkout', purchase: 'purchase', add_to_wishlist: 'add_to_wishlist', search: 'search', newsletter_signup: 'sign_up', apply_coupon: 'select_promotion', select_variant: 'select_item' };
const META_MAP: Record<string, string> = { view_item: 'ViewContent', add_to_cart: 'AddToCart', begin_checkout: 'InitiateCheckout', purchase: 'Purchase', add_to_wishlist: 'AddToWishlist', search: 'Search', newsletter_signup: 'Lead' };
const TT_MAP: Record<string, string> = { view_item: 'ViewContent', add_to_cart: 'AddToCart', begin_checkout: 'InitiateCheckout', purchase: 'CompletePayment', add_to_wishlist: 'AddToWishlist', search: 'Search', newsletter_signup: 'Subscribe' };

export function track(name: string, props: Props = {}) {
  if (typeof window === 'undefined') return;
  const value = typeof props.value === 'number' ? props.value / 100 : undefined;
  try {
    if (window.gtag && GA_MAP[name]) window.gtag('event', GA_MAP[name], { currency: 'NGN', value, ...props });
    if (window.fbq && META_MAP[name]) window.fbq('track', META_MAP[name], { currency: 'NGN', value, content_ids: props.product_id ? [props.product_id] : undefined });
    if (window.ttq && TT_MAP[name]) window.ttq.track(TT_MAP[name], { currency: 'NGN', value, content_id: props.product_id });
  } catch { /* ignore third-party errors */ }
  try {
    const body = JSON.stringify({ name, session_id: sessionId(), path: location.pathname, product_id: props.product_id, value: props.value, properties: props, referrer: document.referrer || null });
    if (!navigator.sendBeacon?.('/api/track', new Blob([body], { type: 'application/json' }))) {
      fetch('/api/track', { method: 'POST', body, headers: { 'content-type': 'application/json' }, keepalive: true }).catch(() => {});
    }
  } catch { /* ignore */ }
}
