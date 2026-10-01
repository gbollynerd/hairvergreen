import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/auth/auth-form';
import { getUser } from '@/lib/auth';
import { safeRedirectPath } from '@/lib/utils';

export const metadata = { title: 'Create an account', robots: { index: false } };

export default async function Register({ searchParams }: PageProps<'/register'>) {
  const sp = await searchParams;
  const next = safeRedirectPath(typeof sp.next === 'string' ? sp.next : null, '/account');
  if (await getUser()) redirect(next);
  return (
    <div className="container-x max-w-lg py-14 md:py-20">
      <p className="eyebrow">Join Hairver Green</p>
      <h1 className="display-2 mt-3">Create an account</h1>
      <AuthForm mode="register" next={next} />
      <p className="mt-6 text-[14px]">Already have an account? <Link href="/login" className="underline">Sign in</Link></p>
    </div>
  );
}
