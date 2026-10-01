import { requireStaffPage } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { PageHeader, Card, Table, Td, Badge } from '@/components/admin/ui';
import { ActionForm, Submit, Field } from '@/components/admin/client';
import { formatDate } from '@/lib/utils';
import { inviteStaff } from './actions';
import { RoleEditor } from './role-editor';

export default async function Staff() {
  const staff = await requireStaffPage('users.manage');
  const db = supabaseAdmin();
  const [{ data: links }, { data: roles }] = await Promise.all([
    db.from('user_roles').select('user_id, role_id, created_at'),
    db.from('roles').select('id, key, name, description').order('created_at'),
  ]);
  const ids = [...new Set((links ?? []).map((l) => l.user_id))];
  const { data: profiles } = ids.length ? await db.from('profiles').select('id, email, full_name, created_at').in('id', ids) : { data: [] as any[] };
  const people = (profiles ?? []).map((p: any) => ({ ...p, roleIds: (links ?? []).filter((l) => l.user_id === p.id).map((l) => l.role_id), since: (links ?? []).filter((l) => l.user_id === p.id).map((l) => l.created_at).sort()[0] }))
    .sort((a, b) => String(a.email).localeCompare(String(b.email)));
  const roleName = Object.fromEntries((roles ?? []).map((r) => [r.id, r.name]));
  return (
    <>
      <PageHeader title="Staff" description="Invite team members and choose what they can do. Every change is recorded in the audit log." />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Table head={['Name', 'Roles', 'Staff since', '']}>
          {people.map((p) => (
            <tr key={p.id}>
              <Td><span className="font-medium">{p.full_name || '—'}</span><span className="block text-[12px] text-muted">{p.email}</span>{p.id === staff.id && <Badge tone="blue">You</Badge>}</Td>
              <Td>{p.roleIds.map((r: string) => <span key={r} className="mr-1"><Badge tone={roleName[r] === 'Super Admin' ? 'purple' : 'gray'}>{roleName[r]}</Badge></span>)}</Td>
              <Td className="text-muted">{formatDate(p.since)}</Td>
              <Td><RoleEditor userId={p.id} email={p.email} current={p.roleIds} roles={roles ?? []} self={p.id === staff.id} /></Td>
            </tr>
          ))}
        </Table>
        <Card title="Invite staff">
          <ActionForm action={inviteStaff} resetOnSuccess className="grid gap-4">
            <Field label="Email"><input name="email" type="email" required className="input" /></Field>
            <Field label="Name"><input name="full_name" className="input" /></Field>
            <fieldset className="grid gap-2"><legend className="mb-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Roles</legend>
              {(roles ?? []).map((r) => (
                <label key={r.id} className="flex gap-2 text-[13px]"><input type="checkbox" name="role_ids" value={r.id} className="mt-0.5" /><span><strong className="font-medium">{r.name}</strong><span className="block text-[12px] text-muted">{r.description}</span></span></label>
              ))}
            </fieldset>
            <Submit>Send invitation</Submit>
            <p className="text-[12px] text-muted">New people get an email to set their password. Existing customers are given access straight away.</p>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
