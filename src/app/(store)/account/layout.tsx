import { requireUserPage } from '@/lib/auth';
import { AccountNav } from '@/components/account/account-nav';

export const metadata = { robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function AccountLayout({ children }: LayoutProps<'/account'>) {
  const user = await requireUserPage('/account');
  return (
    <div className="container-x py-10 md:py-14">
      <p className="eyebrow">My account</p>
      <h1 className="display-2 mt-2">Hello{user.name ? `, ${user.name.split(' ')[0]}` : ''}.</h1>
      <div className="mt-10 grid gap-10 lg:grid-cols-[220px_1fr] lg:gap-16">
        <AccountNav />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
