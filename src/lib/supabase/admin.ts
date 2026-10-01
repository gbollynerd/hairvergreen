import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, serverEnv } from '@/lib/env';

let cached: SupabaseClient | null = null;

/**
 * Service-role client. Bypasses RLS — only use in server code AFTER authorising the caller
 * (see requirePermission in lib/auth.ts) or for trusted system work (webhooks, order creation).
 */
export function supabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  const key = serverEnv().supabaseServiceKey;
  if (!env.supabaseUrl || !key) throw new Error('Supabase service credentials are not configured');
  cached = createClient(env.supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
  });
  return cached;
}
