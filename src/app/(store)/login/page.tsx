import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/auth/auth-form';
import { getUser } from '@/lib/auth';
import { safeRedirectPath } from '@/lib/utils';

export const metadata = { title: 'Sign in', robots: { index: false } };

export default async function Login({ searchParams }: PageProps<'/login'>) {
  const sp = await searchParams;
  const next = safeRedirectPath(typeof sp.next === 'string' ? sp.next : null, '/account');
  if (await getUser()) redirect(next);
  return (
    <div className="container-x grid max-w-5xl gap-14 py-14 md:grid-cols-2 md:py-20">
      <div>
        <p className="eyebrow">Welcome back</p>
        <h1 className="display-2 mt-3">Sign in</h1>
        <AuthForm mode="login" next={next} />
        <p className="mt-6 text-[14px]"><Link href="/forgot-password" className="underline">Forgot your password?</Link></p>
      </div>
      <div className="bg-panel p-8 md:p-10">
        <p className="font-display text-[28px]">New to Hairver Green?</p>
        <ul className="mt-5 space-y-2 text-[15px] text-muted">
          <li>· Track orders and reorder favourites</li><li>· Save addresses for faster checkout</li><li>· Keep your wishlist on every device</li><li>· Restock alerts and early access to drops</li>
        </ul>
        <Link href={`/register${next !== '/account' ? `?next=${encodeURIComponent(next)}` : ''}`} className="btn btn-outline mt-8">Create an account</Link>
        <p className="mt-4 text-[13px] text-muted">You can also check out as a guest.</p>
      </div>
    </div>
  );
}
