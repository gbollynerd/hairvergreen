import { createSupabaseServer } from '@/lib/supabase/server';
import { requireUserPage } from '@/lib/auth';
import { PreferencesForm } from '@/components/account/details-form';

export default async function Notifications() {
  const user = await requireUserPage();
  const sb = await createSupabaseServer();
  const { data: p } = await sb.from('profiles').select('marketing_email, marketing_sms, notify_order_updates, notify_promotions, notify_restock').eq('id', user.id).maybeSingle();
  return (<section className="max-w-xl"><h2 className="font-display text-[26px]">Notifications</h2><p className="mt-1 text-[14px] text-muted">Choose what we send you. Essential order emails (confirmations, receipts) are always sent.</p><PreferencesForm prefs={p ?? {}} /></section>);
}
