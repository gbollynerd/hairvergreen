import Link from 'next/link';
export default async function Forbidden({ searchParams }: PageProps<'/admin/forbidden'>) {
  const { perm } = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center px-4 text-center">
      <div><h1 className="font-display text-[34px]">You don&apos;t have access to this area</h1><p className="mt-2 text-muted">Missing permission: <code>{String(perm ?? '')}</code>. Ask a Super Admin to update your role.</p><Link href="/admin" className="btn btn-primary mt-6">Back to dashboard</Link></div>
    </main>
  );
}
