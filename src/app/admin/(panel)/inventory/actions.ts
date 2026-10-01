'use server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { guarded, refreshStore, type ActionResult } from '@/lib/admin/helpers';
import { audit } from '@/lib/audit';

export async function adjustStock(variantId: string, mode: 'add' | 'set', amount: number, note: string): Promise<ActionResult> {
  return guarded('inventory.edit', async (staff) => {
    if (!Number.isFinite(amount)) return { error: 'Enter a number' };
    const db = supabaseAdmin();
    const { data: v } = await db.from('product_variants').select('stock_on_hand, title, product:product_id (name)').eq('id', variantId).single();
    if (!v) return { error: 'Variant not found' };
    const delta = mode === 'set' ? Math.round(amount) - v.stock_on_hand : Math.round(amount);
    if (!delta) return { ok: true, message: 'No change' };
    const { data: after, error } = await db.rpc('adjust_stock', { p_variant: variantId, p_delta: delta, p_reason: delta > 0 ? 'restock' : 'adjustment', p_note: note || null, p_actor: staff.id });
    if (error) throw error;
    await audit(staff, { action: 'stock_adjust', entityType: 'variant', entityId: variantId, summary: `${(v as any).product?.name} — ${v.title}: ${v.stock_on_hand} → ${after}${note ? ` (${note})` : ''}`, before: { stock_on_hand: v.stock_on_hand }, after: { stock_on_hand: after } });
    refreshStore('catalog');
    return { ok: true, message: `Stock now ${after}` };
  });
}

export async function setThreshold(variantId: string, threshold: number): Promise<ActionResult> {
  return guarded('inventory.edit', async () => {
    await supabaseAdmin().from('product_variants').update({ low_stock_threshold: Math.max(0, Math.round(threshold)) }).eq('id', variantId);
    return { ok: true, message: 'Alert threshold saved' };
  });
}
