import { notFound } from 'next/navigation';
import { getPage } from '@/lib/data/content';
import { SectionRenderer } from '@/components/sections/section-renderer';
import { meta } from '@/lib/seo';

export const revalidate = 300;

export async function generateMetadata() {
  const data = await getPage('home');
  return meta({ title: data?.page.seo_title, description: data?.page.seo_description, path: '/', image: data?.page.og_image?.url });
}

export default async function Home() {
  const data = await getPage('home');
  if (!data) notFound();
  return <SectionRenderer sections={data.sections} />;
}
