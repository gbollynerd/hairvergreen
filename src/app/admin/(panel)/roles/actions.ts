'use server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { guarded, str, type ActionResult } from '@/lib/admin/helpers';
import { audit } from '@/lib/audit';
import { isUuid, slugify } from '@/lib/utils';

export async function createRole(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return guarded('roles.manage', async (staff) => {
    const name = str(fd, 'name').slice(0, 60);
    if (!name) return { error: 'Name the role' };
    const key = slugify(name).replace(/-/g, '_');
    const { data, error } = await supabaseAdmin().from('roles').insert({ key, name, description: str(fd, 'description').slice(0, 200), is_system: false }).select('id').single();
    if (error) throw error;
    await audit(staff, { action: 'create', entityType: 'role', entityId: data.id, summary: `Created role ${name}` });
    return { ok: true, message: 'Role created', redirect: `/admin/roles/${data.id}` };
  });
}

export async function saveRole(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return guarded('roles.manage', async (staff) => {
    const id = str(fd, 'id');
    if (!isUuid(id)) return { error: 'Invalid role' };
    const db = supabaseAdmin();
    const { data: role } = await db.from('roles').select('*, role_permissions (permission_key)').eq('id', id).single();
    if (!role) return { error: 'Role not found' };
    if (role.key === 'super_admin') return { error: 'The Super Admin role always has every permission' };
    const { data: all } = await db.from('permissions').select('key');
    const valid = new Set((all ?? []).map((p) => p.key));
    const next = [...new Set(fd.getAll('perms').map(String).filter((k) => valid.has(k)))];
    const prev = (role.role_permissions as { permission_key: string }[]).map((p) => p.permission_key);
    const changed = [...next.filter((k) => !prev.includes(k)), ...prev.filter((k) => !next.includes(k))];
    if (!staff.isSuperAdmin) {
      const bad = changed.filter((k) => !staff.permissions.has(k));
      if (bad.length) return { error: `You cannot change permissions you do not have yourself: ${bad.join(', ')}` };
      const { data: mine } = await db.from('user_roles').select('role_id').eq('user_id', staff.id).eq('role_id', id).maybeSingle();
      if (mine) return { error: 'Ask a Super Admin to change a role you belong to' };
    }
    await db.from('roles').update({ name: str(fd, 'name').slice(0, 60) || role.name, description: str(fd, 'description').slice(0, 200) }).eq('id', id);
    const remove = prev.filter((k) => !next.includes(k));
    const add = next.filter((k) => !prev.includes(k));
    if (remove.length) await db.from('role_permissions').delete().eq('role_id', id).in('permission_key', remove);
    if (add.length) await db.from('role_permissions').insert(add.map((permission_key) => ({ role_id: id, permission_key })));
    await audit(staff, { action: 'update', entityType: 'role', entityId: id, summary: `Updated role ${role.name} (+${add.length} / −${remove.length})`, before: { permissions: prev }, after: { permissions: next } });
    return { ok: true, message: 'Role saved' };
  });
}

export async function deleteRole(id: string): Promise<ActionResult> {
  return guarded('roles.manage', async (staff) => {
    if (!isUuid(id)) return { error: 'Invalid role' };
    const db = supabaseAdmin();
    const { data: role } = await db.from('roles').select('*').eq('id', id).single();
    if (!role) return { error: 'Role not found' };
    if (role.is_system) return { error: 'Built-in roles cannot be deleted' };
    const { count } = await db.from('user_roles').select('user_id', { count: 'exact', head: true }).eq('role_id', id);
    if (count) return { error: `${count} staff member(s) still have this role. Reassign them first.` };
    await db.from('roles').delete().eq('id', id);
    await audit(staff, { action: 'delete', entityType: 'role', entityId: id, summary: `Deleted role ${role.name}`, before: role });
    return { ok: true, message: 'Role deleted', redirect: '/admin/roles' };
  });
}
