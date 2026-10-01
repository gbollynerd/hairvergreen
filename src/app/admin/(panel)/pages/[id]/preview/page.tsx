import { notFound } from 'next/navigation';
import { requireStaffPage } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getSettings } from '@/lib/data/content';
import { SectionRenderer } from '@/components/sections/section-renderer';
import { StoreProvider } from '@/components/store/store-provider';
import { sanitizeHtml } from '@/lib/sanitize';
import type { PageSection } from '@/lib/types';

// Staff-only preview of a page as currently saved (including drafts and hidden sections are skipped).
export default async function PagePreview({ params }: PageProps<'/admin/pages/[id]/preview'>) {
  await requireStaffPage('content.edit');
  const { id } = await params;
  const db = supabaseAdmin();
  const { data: page } = await db.from('pages').select('*').eq('id', id).maybeSingle();
  if (!page) notFound();
  const { data: sections } = await db.from('page_sections').select('*').eq('page_id', id).order('sort');
  const settings = await getSettings();
  return (
    <StoreProvider currencies={settings.currencies.display}>
      <div className="-mx-4 -my-8 bg-bg md:-mx-8">
        <p className="bg-accent px-4 py-2 text-center text-[12px] uppercase tracking-[0.2em]">Preview · {page.status} · saved version — save your sections to see changes here</p>
        {(sections ?? []).length ? <SectionRenderer sections={(sections ?? []) as PageSection[]} /> : (
          <div className="container-x max-w-3xl py-16">
            <h1 className="display-2">{page.title}</h1>
            {page.body && <div className="prose-hg mt-8" dangerouslySetInnerHTML={{ __html: sanitizeHtml(page.body) }} />}
          </div>
        )}
      </div>
    </StoreProvider>
  );
}
