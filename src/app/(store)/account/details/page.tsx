import { createSupabaseServer } from '@/lib/supabase/server';
import { requireUserPage } from '@/lib/auth';
import { DetailsForm } from '@/components/account/details-form';
import { AuthForm } from '@/components/auth/auth-form';

export default async function Details() {
  const user = await requireUserPage();
  const sb = await createSupabaseServer();
  const { data: p } = await sb.from('profiles').select('full_name, phone, birthday').eq('id', user.id).maybeSingle();
  return (
    <div className="grid gap-12 lg:grid-cols-2">
      <section><h2 className="font-display text-[26px]">Your details</h2><p className="mt-1 text-[14px] text-muted">Email: {user.email}</p><DetailsForm profile={p ?? { full_name: '', phone: '', birthday: null }} /></section>
      <section><h2 className="font-display text-[26px]">Change password</h2><AuthForm mode="reset" /></section>
    </div>
  );
}
