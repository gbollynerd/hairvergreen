import { notFound } from 'next/navigation';
import { requireUserPage } from '@/lib/auth';
import { getOrderForViewer } from '@/lib/commerce/orders';
import { OrderDetail } from '@/components/account/order-detail';

export default async function AccountOrder({ params }: PageProps<'/account/orders/[number]'>) {
  const { number } = await params;
  const user = await requireUserPage();
  const data = await getOrderForViewer(number.toUpperCase(), { userId: user.id });
  if (!data) notFound();
  return <OrderDetail order={data.order} items={data.items} events={data.events} returns={data.returns} token={data.order.access_token} signedIn />;
}
