'use server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { guarded, str, type ActionResult } from '@/lib/admin/helpers';
import { audit } from '@/lib/audit';
import { env } from '@/lib/env';
import { isUuid } from '@/lib/utils';
import type { StaffContext } from '@/lib/auth';

/** A staff member may only hand out roles whose permissions they hold themselves. */
async function assertCanGrant(staff: StaffContext, roleIds: string[]) {
  const db = supabaseAdmin();
  const { data: roles } = await db.from('roles').select('id, key, name, role_permissions (permission_key)').in('id', roleIds);
  if ((roles ?? []).length !== roleIds.length) throw new Error('Unknown role');
  if (staff.isSuperAdmin) return roles!;
  for (const r of roles ?? []) {
    if (r.key === 'super_admin') throw new Error('Only a Super Admin can grant Super Admin');
    const missing = (r.role_permissions as { permission_key: string }[]).filter((p) => !staff.permissions.has(p.permission_key));
    if (missing.length) throw new Error(`You cannot grant “${r.name}” because it includes permissions you do not have`);
  }
  return roles!;
}

async function superAdminCount() {
  const db = supabaseAdmin();
  const { data: role } = await db.from('roles').select('id').eq('key', 'super_admin').single();
  const { count } = await db.from('user_roles').select('user_id', { count: 'exact', head: true }).eq('role_id', role!.id);
  return { roleId: role!.id as string, count: count ?? 0 };
}

export async function inviteStaff(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return guarded('users.manage', async (staff) => {
    const email = str(fd, 'email').toLowerCase();
    const name = str(fd, 'full_name');
    const roleIds = fd.getAll('role_ids').map(String).filter(isUuid);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'Enter a valid email address' };
    if (!roleIds.length) return { error: 'Choose at least one role' };
    await assertCanGrant(staff, roleIds);
    const db = supabaseAdmin();
    let userId: string | null = null;
    const { data: existing } = await db.from('profiles').select('id').eq('email', email).maybeSingle();
    let invited = false;
    if (existing) userId = existing.id;
    else {
      const { data, error } = await db.auth.admin.inviteUserByEmail(email, { redirectTo: `${env.siteUrl}/auth/callback?next=/admin`, data: { full_name: name || undefined } });
      if (error || !data?.user) return { error: `Could not send the invitation: ${error?.message ?? 'unknown error'}` };
      userId = data.user.id; invited = true;
      if (name) await db.from('profiles').update({ full_name: name }).eq('id', userId);
    }
    await db.from('user_roles').upsert(roleIds.map((role_id) => ({ user_id: userId!, role_id, granted_by: staff.id })), { onConflict: 'user_id,role_id', ignoreDuplicates: true });
    await audit(staff, { action: invited ? 'invite' : 'grant_role', entityType: 'staff', entityId: userId, summary: `${invited ? 'Invited' : 'Granted access to'} ${email}`, after: { roleIds } });
    return { ok: true, message: invited ? `Invitation sent to ${email}` : `${email} now has staff access` };
  });
}

export async function setStaffRoles(userId: string, roleIds: string[]): Promise<ActionResult> {
  return guarded('users.manage', async (staff) => {
    if (!isUuid(userId)) return { error: 'Invalid user' };
    const ids = roleIds.filter(isUuid);
    const db = supabaseAdmin();
    const { data: current } = await db.from('user_roles').select('role_id, roles (key, name, role_permissions (permission_key))').eq('user_id', userId);
    const cur = (current ?? []).map((r) => r.role_id as string);
    const adding = ids.filter((i) => !cur.includes(i));
    const removing = cur.filter((i) => !ids.includes(i));
    if (adding.length) await assertCanGrant(staff, adding);
    if (removing.length) await assertCanGrant(staff, removing); // you can't strip roles more powerful than your own
    const sa = await superAdminCount();
    if (removing.includes(sa.roleId)) {
      if (userId === staff.id) return { error: 'You cannot remove your own Super Admin role' };
      if (sa.count <= 1) return { error: 'There must always be at least one Super Admin' };
    }
    if (removing.length) await db.from('user_roles').delete().eq('user_id', userId).in('role_id', removing);
    if (adding.length) await db.from('user_roles').insert(adding.map((role_id) => ({ user_id: userId, role_id, granted_by: staff.id })));
    await audit(staff, { action: 'update_roles', entityType: 'staff', entityId: userId, summary: `Changed staff roles`, before: { roleIds: cur }, after: { roleIds: ids } });
    return { ok: true, message: ids.length ? 'Roles updated' : 'Staff access removed' };
  });
}

export async function removeStaff(userId: string): Promise<ActionResult> {
  if (!isUuid(userId)) return { error: 'Invalid user' };
  return setStaffRoles(userId, []);
}
