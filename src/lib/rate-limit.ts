import 'server-only';
import { headers } from 'next/headers';

// Lightweight fixed-window limiter (per server instance). Protects forms and auth endpoints from
// casual abuse. For multi-region hard limits, swap for a shared store (e.g. Upstash Redis).
const buckets = new Map<string, { count: number; reset: number }>();

export async function rateLimit(key: string, limit = 20, windowMs = 60_000) {
  const h = await headers();
  const ip = (h.get('x-forwarded-for') || '').split(',')[0].trim() || h.get('x-real-ip') || 'local';
  const k = `${key}:${ip}`;
  const now = Date.now();
  const b = buckets.get(k);
  if (!b || b.reset < now) {
    buckets.set(k, { count: 1, reset: now + windowMs });
    if (buckets.size > 5000) for (const [kk, v] of buckets) if (v.reset < now) buckets.delete(kk);
    return { ok: true, remaining: limit - 1 };
  }
  b.count++;
  return { ok: b.count <= limit, remaining: Math.max(0, limit - b.count) };
}
