import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { serverEnv, isConfigured } from '@/lib/env';

export type SessionUser = { id: string; email: string; name: string | null };
export type StaffContext = SessionUser & { permissions: Set<string>; roles: string[]; isSuperAdmin: boolean };

/** The signed-in user (verified with Supabase Auth), or null. Cached per request. */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  if (!isConfigured()) return null;
  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const meta = data.user.user_metadata || {};
  return { id: data.user.id, email: data.user.email ?? '', name: (meta.full_name as string) || (meta.name as string) || null };
});

/** Staff context with effective permissions (server-side source of truth). */
export const getStaff = cache(async (): Promise<StaffContext | null> => {
  const user = await getUser();
  if (!user) return null;
  const db = supabaseAdmin();

  // Bootstrap: emails listed in BOOTSTRAP_SUPER_ADMIN_EMAILS are granted Super Admin on first visit.
  const boot = serverEnv().bootstrapAdmins;
  if (boot.includes(user.email.toLowerCase())) {
    const { data: role } = await db.from('roles').select('id').eq('key', 'super_admin').single();
    if (role) await db.from('user_roles').upsert({ user_id: user.id, role_id: role.id }, { onConflict: 'user_id,role_id', ignoreDuplicates: true });
  }

  const [{ data: roleRows }, { data: perms }] = await Promise.all([
    db.from('user_roles').select('roles(key)').eq('user_id', user.id),
    db.rpc('user_permissions', { uid: user.id }),
  ]);
  const roles = (roleRows ?? []).map((r: any) => r.roles?.key).filter(Boolean) as string[];
  if (!roles.length) return null;
  return { ...user, roles, isSuperAdmin: roles.includes('super_admin'), permissions: new Set((perms as string[] | null) ?? []) };
});

export class PermissionError extends Error {
  constructor(public permission: string) { super(`You don't have permission to do that (${permission}).`); }
}

/** Use in server actions / route handlers. Throws if the caller lacks the permission. */
export async function requirePermission(...perms: string[]): Promise<StaffContext> {
  const staff = await getStaff();
  if (!staff) throw new PermissionError(perms[0] ?? 'staff');
  for (const p of perms) if (!staff.permissions.has(p)) throw new PermissionError(p);
  return staff;
}

export async function requireAnyPermission(...perms: string[]): Promise<StaffContext> {
  const staff = await getStaff();
  if (!staff || !perms.some((p) => staff.permissions.has(p))) throw new PermissionError(perms.join(' | '));
  return staff;
}

/** Use in admin pages: redirects to login when signed out, shows 403 page when lacking permission. */
export async function requireStaffPage(perm?: string | string[]): Promise<StaffContext> {
  const user = await getUser();
  if (!user) redirect('/admin/login');
  const staff = await getStaff();
  if (!staff) redirect('/admin/login?error=not_staff');
  const perms = perm ? (Array.isArray(perm) ? perm : [perm]) : [];
  if (perms.length && !perms.some((p) => staff.permissions.has(p))) redirect('/admin/forbidden?perm=' + encodeURIComponent(perms.join(' or ')));
  return staff;
}

export async function requireUserPage(next = '/account'): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect('/login?next=' + encodeURIComponent(next));
  return user;
}

export async function requestMeta() {
  const h = await headers();
  return {
    ip: (h.get('x-forwarded-for') || '').split(',')[0].trim() || h.get('x-real-ip') || null,
    userAgent: h.get('user-agent') || null,
  };
}
