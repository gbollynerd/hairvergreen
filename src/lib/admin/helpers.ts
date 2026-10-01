import 'server-only';
import { revalidatePath, updateTag, revalidateTag } from 'next/cache';
import { PermissionError, requirePermission, requireAnyPermission, type StaffContext } from '@/lib/auth';
import { CATALOG_TAG } from '@/lib/data/catalog';
import { CONTENT_TAG } from '@/lib/data/content';

export type ActionResult = { ok?: boolean; error?: string; message?: string; id?: string; redirect?: string } | null;

/** Wrap a server action with a permission check and uniform error handling. */
export async function guarded(perm: string | string[], fn: (staff: StaffContext) => Promise<ActionResult>): Promise<ActionResult> {
  try {
    const staff = Array.isArray(perm) ? await requireAnyPermission(...perm) : await requirePermission(perm);
    return await fn(staff);
  } catch (e) {
    if (e instanceof PermissionError) return { error: e.message };
    // Next.js redirect()/notFound() must propagate
    if (e && typeof e === 'object' && 'digest' in e && String((e as { digest: string }).digest).startsWith('NEXT_')) throw e;
    console.error('[admin action]', e);
    const msg = e instanceof Error ? e.message : String(e);
    if (/duplicate key/.test(msg)) return { error: 'That value is already in use (e.g. slug, SKU or code must be unique).' };
    return { error: msg.length < 200 ? msg : 'Something went wrong' };
  }
}

/** Refresh storefront caches after an admin change. */
export function refreshStore(kind: 'catalog' | 'content' | 'all' = 'all') {
  try {
    if (kind === 'catalog' || kind === 'all') updateTag(CATALOG_TAG);
    if (kind === 'content' || kind === 'all') updateTag(CONTENT_TAG);
  } catch {
    if (kind === 'catalog' || kind === 'all') revalidateTag(CATALOG_TAG, 'max');
    if (kind === 'content' || kind === 'all') revalidateTag(CONTENT_TAG, 'max');
  }
  revalidatePath('/', 'layout');
}

// FormData helpers
export const str = (fd: FormData, k: string) => { const v = fd.get(k); return v == null ? '' : String(v).trim(); };
export const strOrNull = (fd: FormData, k: string) => str(fd, k) || null;
export const num = (fd: FormData, k: string) => { const v = str(fd, k); return v === '' ? null : Number(v); };
export const int = (fd: FormData, k: string, d = 0) => { const v = str(fd, k); return v === '' || isNaN(Number(v)) ? d : Math.round(Number(v)); };
export const bool = (fd: FormData, k: string) => { const v = fd.get(k); return v === 'on' || v === 'true' || v === '1'; };
export const json = <T,>(fd: FormData, k: string, d: T): T => { try { const v = str(fd, k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } };
export const dateOrNull = (fd: FormData, k: string) => { const v = str(fd, k); if (!v) return null; const d = new Date(v); return isNaN(+d) ? null : d.toISOString(); };
