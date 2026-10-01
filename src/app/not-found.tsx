import Link from 'next/link';
import { Mark } from '@/components/ui/logo';

export default function NotFound() {
  return (
    <main className="grid min-h-[80vh] place-items-center bg-bg px-6 text-center">
      <div>
        <Mark className="mx-auto h-16 w-auto text-accent-strong" />
        <h1 className="display-2 mt-8">This page has moved on.</h1>
        <p className="lede mx-auto mt-4 max-w-md">The piece or page you were looking for isn&apos;t here. Let us help you find something beautiful.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3"><Link href="/" className="btn btn-primary">Back to home</Link><Link href="/shop" className="btn btn-outline">Shop all</Link></div>
      </div>
    </main>
  );
}
