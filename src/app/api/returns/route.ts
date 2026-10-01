import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getUser } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { sendEmail, adminAlertEmail, simpleEmail } from '@/lib/email';
import { env } from '@/lib/env';

const Body = z.object({
  order_number: z.string().max(30), token: z.string().max(64).optional(),
  items: z.array(z.object({ order_item_id: z.uuid(), quantity: z.number().int().min(1).max(50), reason: z.string().max(200).optional() })).min(1).max(30),
  reason: z.string().trim().min(2).max(200), resolution: z.enum(['refund', 'exchange', 'store_credit']), note: z.string().max(1500).optional(),
  media: z.array(z.object({ path: z.string().max(300), bucket: z.string().max(40) })).max(6).optional(),
});

export async function POST(req: NextRequest) {
  const rl = await rateLimit('returns', 5, 10 * 60_000);
  if (!rl.ok) return NextResponse.json({ error: 'Please try again later.' }, { status: 429 });
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: 'Please choose the items and a reason.' }, { status: 400 });
  const user = await getUser();
  const db = supabaseAdmin();
  const { data: order } = await db.from('orders').select('*').eq('order_number', p.data.order_number.toUpperCase()).maybeSingle();
  if (!order || !((p.data.token && order.access_token === p.data.token) || (user && order.user_id === user.id)))
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (!['shipped', 'delivered'].includes(order.status)) return NextResponse.json({ error: 'Returns can be requested once your order has been delivered.' }, { status: 400 });
  const { data: open } = await db.from('return_requests').select('id').eq('order_id', order.id).in('status', ['requested', 'approved', 'awaiting_item']).limit(1);
  if (open?.length) return NextResponse.json({ error: 'There is already an open return for this order.' }, { status: 409 });
  const { data: items } = await db.from('order_items').select('id, quantity, returned_quantity, product_name').eq('order_id', order.id);
  for (const it of p.data.items) {
    const oi = items?.find((x) => x.id === it.order_item_id);
    if (!oi || it.quantity > oi.quantity - oi.returned_quantity) return NextResponse.json({ error: 'Invalid return quantity' }, { status: 400 });
  }
  const media = (p.data.media ?? []).filter((m) => m.bucket === 'customer-uploads' && m.path.startsWith('returns/'));
  const { data: rr, error } = await db.from('return_requests').insert({
    order_id: order.id, user_id: user?.id ?? order.user_id, email: order.email, reason: p.data.reason, resolution: p.data.resolution,
    items: p.data.items, customer_note: p.data.note ?? null, media,
  }).select('id, rma_number').single();
  if (error || !rr) return NextResponse.json({ error: 'Could not create the return' }, { status: 500 });
  await db.from('order_events').insert({ order_id: order.id, type: 'return', message: `Return ${rr.rma_number} requested (${p.data.resolution.replace('_', ' ')})`, is_internal: false });
  await sendEmail({ to: order.email, ...simpleEmail(`Return ${rr.rma_number} received`, 'We’ve received your return request.', [`Your reference is ${rr.rma_number}. Our team will review it and email you with next steps, usually within 2 business days.`]) });
  const { data: notif } = await db.from('settings').select('value').eq('key', 'notifications').maybeSingle();
  const to = (notif?.value as { order_alert_emails?: string[] } | null)?.order_alert_emails;
  if (to?.length) await sendEmail({ to, ...adminAlertEmail(`Return requested: ${order.order_number}`, [`${rr.rma_number} · ${p.data.resolution}`, p.data.reason], `${env.siteUrl}/admin/returns/${rr.id}`) });
  return NextResponse.json({ ok: true, rma_number: rr.rma_number });
}
