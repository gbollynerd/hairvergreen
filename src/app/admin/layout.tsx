import type { Metadata } from 'next';
import { AdminToaster } from '@/components/admin/client';

export const metadata: Metadata = { title: { default: 'Admin', template: '%s · Hairver Green Admin' }, robots: { index: false, follow: false } };

export default function AdminRoot({ children }: LayoutProps<'/admin'>) {
  return <div className="min-h-screen bg-[#f3f0e8] text-ink">{children}<AdminToaster /></div>;
}
