import { requireStaffPage } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { PageHeader } from '@/components/admin/ui';
import { MenuEditor } from './menu-editor';

const ORDER = ['main', 'mobile_bottom', 'footer_shop', 'footer_care', 'footer_brand', 'footer_legal'];

export default async function Navigation({ searchParams }: PageProps<'/admin/navigation'>) {
  await requireStaffPage('navigation.manage');
  const sp = await searchParams;
  const { data } = await supabaseAdmin().from('menus').select('key, name, items, updated_at');
  const rank = (k: string) => (ORDER.includes(k) ? ORDER.indexOf(k) : 99);
  const menus = (data ?? []).sort((a, b) => rank(a.key) - rank(b.key));
  const key = typeof sp.menu === 'string' && menus.some((m) => m.key === sp.menu) ? sp.menu : menus[0]?.key;
  const menu = menus.find((m) => m.key === key);
  return (
    <>
      <PageHeader title="Navigation" description="Edit the main menu (with dropdowns and a featured image) and the footer link groups." />
      <div className="mb-6 flex flex-wrap gap-2 text-[13px]">
        {menus.map((m) => <a key={m.key} href={`/admin/navigation?menu=${m.key}`} className={`border px-3 py-1.5 ${m.key === key ? 'border-primary bg-primary text-primary-contrast' : 'border-line bg-surface'}`}>{m.name}</a>)}
      </div>
      {menu ? <MenuEditor key={menu.key} menuKey={menu.key} name={menu.name} initial={(menu.items ?? []) as any[]} nested={menu.key === 'main'} /> : <p className="text-muted">No menus found.</p>}
    </>
  );
}
