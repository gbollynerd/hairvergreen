import Link from 'next/link';
import { requireStaffPage } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { PageHeader, Card, Table, Td, Badge } from '@/components/admin/ui';
import { ActionForm, Submit, Field } from '@/components/admin/client';
import { createRole } from './actions';

export default async function Roles() {
  await requireStaffPage('roles.manage');
  const db = supabaseAdmin();
  const [{ data: roles }, { data: links }, { count: total }] = await Promise.all([
    db.from('roles').select('id, key, name, description, is_system, role_permissions (permission_key)').order('created_at'),
    db.from('user_roles').select('role_id'),
    db.from('permissions').select('key', { count: 'exact', head: true }),
  ]);
  const members = (links ?? []).reduce<Record<string, number>>((a, l) => ((a[l.role_id] = (a[l.role_id] ?? 0) + 1), a), {});
  return (
    <>
      <PageHeader title="Roles & permissions" description="Each role is a set of permissions. Give staff the smallest set they need." />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <Table head={['Role', 'Permissions', 'Staff', '']}>
          {(roles ?? []).map((r: any) => (
            <tr key={r.id}>
              <Td><Link href={`/admin/roles/${r.id}`} className="font-medium underline">{r.name}</Link>{r.is_system && <span className="ml-2"><Badge>Built-in</Badge></span>}<span className="block text-[12px] text-muted">{r.description}</span></Td>
              <Td className="tabular-nums">{r.key === 'super_admin' ? 'All' : `${r.role_permissions.length} of ${total ?? 0}`}</Td>
              <Td className="tabular-nums">{members[r.id] ?? 0}</Td>
              <Td><Link href={`/admin/roles/${r.id}`} className="text-[13px] underline">{r.key === 'super_admin' ? 'View' : 'Edit'}</Link></Td>
            </tr>
          ))}
        </Table>
        <Card title="New role">
          <ActionForm action={createRole} className="grid gap-4">
            <Field label="Name"><input name="name" required className="input" placeholder="e.g. Fulfilment" /></Field>
            <Field label="Description"><input name="description" className="input" /></Field>
            <Submit>Create role</Submit>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
