import 'server-only';
import { env, serverEnv } from '@/lib/env';
import { formatMoney } from '@/lib/money';
import type { Order, OrderItem } from '@/lib/types';

// Transactional email via Resend's HTTP API (no SDK needed). When RESEND_API_KEY is not set the
// message is logged and skipped so development and previews never fail on email.

type Mail = { to: string | string[]; subject: string; html: string; replyTo?: string };

export async function sendEmail(m: Mail) {
  const { resendApiKey, emailFrom } = serverEnv();
  if (!resendApiKey) {
    console.info(`[email:skipped] to=${m.to} subject="${m.subject}"`);
    return { skipped: true };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: emailFrom, to: m.to, subject: m.subject, html: m.html, reply_to: m.replyTo }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) console.error('[email] failed', res.status, await res.text());
    return { ok: res.ok };
  } catch (e) {
    console.error('[email] error', e);
    return { ok: false };
  }
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

function layout(title: string, body: string, preheader = '') {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)}</title></head>
<body style="margin:0;background:#F6F2EA;font-family:Georgia,'Times New Roman',serif;color:#1B1A17">
<span style="display:none;opacity:0">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFDF8;border:1px solid #E3D9C4">
<tr><td style="background:#0F3D2E;padding:28px;text-align:center">
<div style="font-size:22px;letter-spacing:8px;color:#EFE6D2">HAIRVER GREEN</div>
<div style="width:40px;height:1px;background:#D8C08E;margin:12px auto"></div>
<div style="font-family:Arial,sans-serif;font-size:10px;letter-spacing:4px;color:#D8C08E">LUXURY HAIR HOUSE · LAGOS</div></td></tr>
<tr><td style="padding:32px 28px;font-size:16px;line-height:1.6">${body}</td></tr>
<tr><td style="padding:20px 28px;border-top:1px solid #E3D9C4;font-family:Arial,sans-serif;font-size:12px;color:#6B665C;text-align:center">
Hairver Green · Lagos, Nigeria · <a href="${env.siteUrl}" style="color:#0F3D2E">${env.siteUrl.replace(/^https?:\/\//, '')}</a></td></tr>
</table></td></tr></table></body></html>`;
}

const button = (href: string, label: string) =>
  `<p style="margin:28px 0"><a href="${href}" style="display:inline-block;background:#0F3D2E;color:#F6F2EA;padding:14px 26px;text-decoration:none;font-family:Arial,sans-serif;font-size:12px;letter-spacing:3px;text-transform:uppercase">${esc(label)}</a></p>`;

function itemsTable(order: Order, items: OrderItem[]) {
  const rows = items.map((i) => `<tr><td style="padding:10px 0;border-bottom:1px solid #EFE6D2">${esc(i.product_name)}<br><span style="font-family:Arial,sans-serif;font-size:12px;color:#6B665C">${esc(i.variant_title || '')} × ${i.quantity}</span></td>
<td style="padding:10px 0;border-bottom:1px solid #EFE6D2;text-align:right;font-family:Arial,sans-serif;font-size:14px">${formatMoney(i.line_total)}</td></tr>`).join('');
  const line = (l: string, v: string, bold = false) => `<tr><td style="padding:4px 0;font-family:Arial,sans-serif;font-size:13px;${bold ? 'font-weight:bold' : 'color:#6B665C'}">${l}</td><td style="padding:4px 0;text-align:right;font-family:Arial,sans-serif;font-size:13px;${bold ? 'font-weight:bold' : ''}">${v}</td></tr>`;
  return `<table width="100%" cellpadding="0" cellspacing="0">${rows}
${line('Subtotal', formatMoney(order.subtotal))}
${order.discount_total ? line('Discount', '−' + formatMoney(order.discount_total)) : ''}
${line('Shipping', order.shipping_total ? formatMoney(order.shipping_total) : 'Free')}
${order.tax_total ? line('Tax', formatMoney(order.tax_total)) : ''}
${line('Total', formatMoney(order.total), true)}</table>`;
}

export const orderLink = (o: Pick<Order, 'order_number'> & { access_token?: string }) =>
  `${env.siteUrl}/orders/${o.order_number}${o.access_token ? `?t=${o.access_token}` : ''}`;

export function orderConfirmationEmail(order: Order & { access_token?: string }, items: OrderItem[]) {
  const name = order.customer_name?.split(' ')[0] || 'there';
  const addr = order.shipping_address;
  const review = order.requires_review
    ? `<p style="background:#EFE6D2;padding:14px;font-family:Arial,sans-serif;font-size:13px">Your order includes a custom piece. Our team will review your configuration and contact you to confirm every detail before production begins.</p>` : '';
  return {
    subject: `Your Hairver Green order ${order.order_number} is confirmed`,
    html: layout('Order confirmed', `<h1 style="font-weight:normal;font-size:28px;margin:0 0 8px">Thank you, ${esc(name)}.</h1>
<p>We've received your payment for order <strong>${esc(order.order_number)}</strong>. We'll let you know as soon as it's on its way.</p>${review}
${itemsTable(order, items)}
${addr ? `<p style="font-family:Arial,sans-serif;font-size:13px;color:#6B665C;margin-top:24px"><strong style="color:#1B1A17">Delivering to</strong><br>${esc(addr.first_name)} ${esc(addr.last_name)}<br>${esc(addr.line1)}${addr.line2 ? ', ' + esc(addr.line2) : ''}<br>${esc(addr.city)}${addr.state ? ', ' + esc(addr.state) : ''} ${esc(addr.postal_code || '')}<br>${esc(addr.country)}</p>` : ''}
${button(orderLink(order), 'View your order')}`, `Order ${order.order_number} confirmed`),
  };
}

export function orderShippedEmail(order: Order & { access_token?: string }) {
  return {
    subject: `Your order ${order.order_number} is on its way`,
    html: layout('Shipped', `<h1 style="font-weight:normal;font-size:28px;margin:0 0 8px">It's on its way.</h1>
<p>Order <strong>${esc(order.order_number)}</strong> has shipped${order.carrier ? ` with ${esc(order.carrier)}` : ''}.</p>
${order.tracking_number ? `<p style="font-family:Arial,sans-serif;font-size:14px">Tracking number: <strong>${esc(order.tracking_number)}</strong></p>` : ''}
${order.tracking_url ? button(order.tracking_url, 'Track your parcel') : button(orderLink(order), 'View your order')}`),
  };
}

export function orderStatusEmail(order: Order & { access_token?: string }, headline: string, message: string) {
  return {
    subject: `${headline} — order ${order.order_number}`,
    html: layout(headline, `<h1 style="font-weight:normal;font-size:26px;margin:0 0 8px">${esc(headline)}</h1><p>${esc(message)}</p>${button(orderLink(order), 'View your order')}`),
  };
}

export function refundEmail(order: Order & { access_token?: string }, amount: number) {
  return {
    subject: `Refund issued for order ${order.order_number}`,
    html: layout('Refund issued', `<h1 style="font-weight:normal;font-size:26px;margin:0 0 8px">Your refund is on its way.</h1>
<p>We've issued a refund of <strong>${formatMoney(amount)}</strong> for order ${esc(order.order_number)}. Depending on your bank, it can take up to 10 business days to appear.</p>${button(orderLink(order), 'View your order')}`),
  };
}

export function simpleEmail(subject: string, heading: string, paragraphs: string[], cta?: { href: string; label: string }) {
  return { subject, html: layout(subject, `<h1 style="font-weight:normal;font-size:26px;margin:0 0 8px">${esc(heading)}</h1>${paragraphs.map((p) => `<p>${esc(p)}</p>`).join('')}${cta ? button(cta.href, cta.label) : ''}`) };
}

export function adminAlertEmail(subject: string, lines: string[], href?: string) {
  return { subject, html: layout(subject, `<h2 style="font-weight:normal">${esc(subject)}</h2><ul style="font-family:Arial,sans-serif;font-size:14px">${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>${href ? button(href, 'Open in admin') : ''}`) };
}
