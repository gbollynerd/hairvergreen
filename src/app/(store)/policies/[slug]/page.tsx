import { notFound } from 'next/navigation';
import { getPage } from '@/lib/data/content';
import { sanitizeHtml } from '@/lib/sanitize';
import { formatDate } from '@/lib/utils';
import { meta } from '@/lib/seo';

export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<'/policies/[slug]'>) {
  const { slug } = await params;
  const p = await getPage(slug);
  return p ? meta({ title: p.page.seo_title || p.page.title, description: p.page.seo_description, path: `/policies/${slug}`, noindex: p.page.noindex }) : {};
}

export default async function Policy({ params }: PageProps<'/policies/[slug]'>) {
  const { slug } = await params;
  const data = await getPage(slug);
  if (!data || data.page.kind !== 'policy') notFound();
  return (
    <div className="container-x max-w-3xl py-14 md:py-20">
      <p className="eyebrow">Policies</p>
      <h1 className="display-2 mt-3">{data.page.title}</h1>
      <p className="mt-3 text-[13px] text-muted">Last updated {formatDate(data.page.updated_at)}</p>
      <div className="prose-hg mt-10" dangerouslySetInnerHTML={{ __html: sanitizeHtml(data.page.body || '') }} />
    </div>
  );
}
