import { getSettings } from '@/lib/data/content';
import { StoreProvider } from '@/components/store/store-provider';
import { Toasts } from '@/components/layout/toasts';
import { CartDrawer } from '@/components/store/cart-drawer';

// Distraction-free checkout: no site navigation, footer or popups.
export default async function CheckoutLayout({ children }: LayoutProps<'/'>) {
  const settings = await getSettings();
  return (
    <StoreProvider currencies={settings.currencies.display}>
      <main id="main">{children}</main>
      <CartDrawer />
      <Toasts />
    </StoreProvider>
  );
}
