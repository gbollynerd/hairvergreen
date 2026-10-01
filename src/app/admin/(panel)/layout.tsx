import { requireStaffPage } from '@/lib/auth';
import { AdminShell } from '@/components/admin/shell';

export const dynamic = 'force-dynamic';

export default async function PanelLayout({ children }: LayoutProps<'/admin'>) {
  const staff = await requireStaffPage();
  return <AdminShell staff={{ email: staff.email, name: staff.name, roles: staff.roles, permissions: [...staff.permissions] }}>{children}</AdminShell>;
}
