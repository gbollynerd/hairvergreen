import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { COUNTRIES } from '@/lib/utils';
import type { OptionSource, ResourceDef } from '@/lib/admin/resources';

export async function loadOptions(def: ResourceDef) {
  const sources = new Set(def.fields.map((f) => f.optionsFrom).filter(Boolean) as OptionSource[]);
  const db = supabaseAdmin();
  const out: Partial<Record<OptionSource, [string, string][]>> = {};
  await Promise.all([...sources].map(async (s) => {
    switch (s) {
      case 'categories': { const { data } = await db.from('categories').select('id, name').order('sort'); out[s] = (data ?? []).map((r) => [r.id, r.name]); break; }
      case 'collections': { const { data } = await db.from('collections').select('id, name').order('sort'); out[s] = (data ?? []).map((r) => [r.id, r.name]); break; }
      case 'products': { const { data } = await db.from('products').select('id, name, status').neq('status', 'archived').order('name'); out[s] = (data ?? []).map((r) => [r.id, `${r.name}${r.status !== 'active' ? ` (${r.status})` : ''}`]); break; }
      case 'shipping_zones': { const { data } = await db.from('shipping_zones').select('id, name').order('sort'); out[s] = (data ?? []).map((r) => [r.id, r.name]); break; }
      case 'campaigns': { const { data } = await db.from('campaigns').select('id, name'); out[s] = (data ?? []).map((r) => [r.id, r.name]); break; }
      case 'pages': { const { data } = await db.from('pages').select('id, title'); out[s] = (data ?? []).map((r) => [r.id, r.title]); break; }
      case 'popups': { const { data } = await db.from('popups').select('id, name'); out[s] = (data ?? []).map((r) => [r.id, r.name]); break; }
      case 'blog_categories': { const { data } = await db.from('blog_categories').select('id, name').order('sort'); out[s] = (data ?? []).map((r) => [r.id, r.name]); break; }
      case 'countries': out[s] = COUNTRIES; break;
      case 'staff': {
        const { data } = await db.from('user_roles').select('user_id');
        const ids = [...new Set((data ?? []).map((r) => r.user_id))];
        const { data: profs } = ids.length ? await db.from('profiles').select('id, email, full_name').in('id', ids) : { data: [] };
        out[s] = (profs ?? []).map((p: any) => [p.id, p.full_name || p.email]); break;
      }
    }
  }));
  return out;
}
