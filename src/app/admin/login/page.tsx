import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/auth/auth-form';
import { getStaff, getUser } from '@/lib/auth';
import { Mark } from '@/components/ui/logo';

export const dynamic = 'force-dynamic';

export default async function AdminLogin({ searchParams }: PageProps<'/admin/login'>) {
  const sp = await searchParams;
  const user = await getUser();
  if (user && (await getStaff())) redirect('/admin');
  return (
    <main className="grid min-h-screen place-items-center bg-primary px-4">
      <div className="w-full max-w-md bg-surface p-8 md:p-10">
        <Mark className="mx-auto h-12 w-auto text-accent-strong" />
        <p className="wordmark mt-4 text-center text-[16px]">Hairver Green</p>
        <p className="mt-1 text-center text-[11px] uppercase tracking-[0.3em] text-muted">Admin</p>
        {(sp.error === 'not_staff' || (user && !(await getStaff()))) && <p className="mt-6 bg-panel p-3 text-[13px]">You&apos;re signed in as {user?.email}, which doesn&apos;t have staff access. Ask a Super Admin to invite you.</p>}
        <AuthForm mode="admin" next="/admin" />
      </div>
    </main>
  );
}
