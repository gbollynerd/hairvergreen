import { notFound } from 'next/navigation';
import { requireStaffPage } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { PageHeader, Card } from '@/components/admin/ui';
import { ActionForm, Submit, Field, ActionButton } from '@/components/admin/client';
import { titleCase } from '@/lib/utils';
import { saveRole, deleteRole } from '../actions';

export default async function RoleDetail({ params }: PageProps<'/admin/roles/[id]'>) {
  const staff = await requireStaffPage('roles.manage');
  const { id } = await params;
  const db = supabaseAdmin();
  const { data: role } = await db.from('roles').select('*, role_permissions (permission_key)').eq('id', id).maybeSingle();
  if (!role) notFound();
  const { data: perms } = await db.from('permissions').select('key, grp, description').order('grp').order('key');
  const has = new Set((role.role_permissions as { permission_key: string }[]).map((p) => p.permission_key));
  const locked = role.key === 'super_admin';
  const groups = (perms ?? []).reduce<Record<string, typeof perms>>((a, p) => ((a[p.grp] = [...(a[p.grp] ?? []), p]), a), {});
  return (
    <>
      <PageHeader back={{ href: '/admin/roles', label: 'Roles' }} title={role.name} description={role.description}
        actions={!role.is_system ? <ActionButton variant="danger" confirm="Delete this role?" action={deleteRole.bind(null, id)}>Delete role</ActionButton> : undefined} />
      {locked && <p className="mb-5 border border-line bg-panel px-4 py-3 text-[13px]">Super Admin always has every permission and cannot be edited.</p>}
      <ActionForm action={saveRole} className="grid gap-6">
        <input type="hidden" name="id" value={id} />
        <fieldset disabled={locked} className="grid gap-6">
          <Card title="Details"><div className="grid gap-4 md:grid-cols-2"><Field label="Name"><input name="name" defaultValue={role.name} className="input" /></Field><Field label="Description"><input name="description" defaultValue={role.description} className="input" /></Field></div></Card>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Object.entries(groups).map(([grp, list]) => (
              <Card key={grp} title={titleCase(grp)}>
                <div className="grid gap-2.5">
                  {(list ?? []).map((p) => {
                    const mine = staff.isSuperAdmin || staff.permissions.has(p.key);
                    return (
                      <label key={p.key} className={`flex gap-2 text-[13px] ${mine ? '' : 'opacity-50'}`} title={mine ? undefined : 'You do not hold this permission'}>
                        <input type="checkbox" name="perms" value={p.key} defaultChecked={locked || has.has(p.key)} disabled={!mine} className="mt-0.5" />
                        <span>{p.description}<span className="block font-mono text-[11px] text-muted">{p.key}</span></span>
                        {!mine && has.has(p.key) && <input type="hidden" name="perms" value={p.key} />}
                      </label>
                    );
                  })}
                </div>
              </Card>
            ))}
          </div>
          {!locked && <div><Submit>Save role</Submit></div>}
        </fieldset>
      </ActionForm>
    </>
  );
}
