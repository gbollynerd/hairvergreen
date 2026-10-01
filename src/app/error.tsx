'use client';
import Link from 'next/link';

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-[70vh] place-items-center px-6 text-center">
      <div>
        <h1 className="display-2">Something went wrong.</h1>
        <p className="lede mx-auto mt-4 max-w-md">We&apos;ve been notified. Please try again — your bag is safe.</p>
        <div className="mt-8 flex justify-center gap-3"><button type="button" onClick={reset} className="btn btn-primary">Try again</button><Link href="/" className="btn btn-outline">Home</Link></div>
      </div>
    </main>
  );
}
