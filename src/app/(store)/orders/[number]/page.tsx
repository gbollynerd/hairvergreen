import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getOrderForViewer } from '@/lib/commerce/orders';
import { getUser } from '@/lib/auth';
import { OrderDetail } from '@/components/account/order-detail';

export const metadata = { title: 'Your order', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function OrderPage({ params, searchParams }: PageProps<'/orders/[number]'>) {
  const { number } = await params;
  const sp = await searchParams;
  const user = await getUser();
  const data = await getOrderForViewer(number.toUpperCase(), { token: typeof sp.t === 'string' ? sp.t : null, userId: user?.id ?? null });
  if (!data) notFound();
  const isNew = sp.new === '1';
  return (
    <div className="container-x max-w-5xl py-12 md:py-16">
      {isNew && data.order.payment_status === 'paid' && (
        <div className="mb-12 text-center">
          <p className="eyebrow">Thank you</p>
          <h1 className="display-2 mt-3">Your order is confirmed.</h1>
          <p className="lede mx-auto mt-4 max-w-xl">We&apos;ve sent a confirmation to {data.order.email}. {data.order.requires_review ? 'Our team will be in touch to confirm the details of your custom piece before production begins.' : 'We’ll email you again when it ships.'}</p>
          {!user && <p className="mt-6 text-[14px]"><Link href={`/register?next=/account/orders`} className="underline">Create an account</Link> to track orders and reorder in one tap.</p>}
        </div>
      )}
      <OrderDetail order={data.order} items={data.items} events={data.events} returns={data.returns} token={typeof sp.t === 'string' ? sp.t : undefined} signedIn={!!user} />
    </div>
  );
}
