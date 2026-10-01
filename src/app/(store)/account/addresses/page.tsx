import { createSupabaseServer } from '@/lib/supabase/server';
import { AddressBook } from '@/components/account/address-book';
import type { Address } from '@/lib/types';

export default async function Addresses() {
  const sb = await createSupabaseServer();
  const { data } = await sb.from('addresses').select('*').order('is_default_shipping', { ascending: false }).order('created_at');
  return <AddressBook addresses={(data ?? []) as Address[]} />;
}
