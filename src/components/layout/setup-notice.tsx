export function SetupNotice() {
  return (
    <main className="grid min-h-screen place-items-center bg-primary p-8 text-center text-primary-contrast">
      <div className="max-w-lg">
        <p className="wordmark text-2xl">Hairver Green</p>
        <p className="mt-6 text-primary-contrast/80">The store isn&apos;t connected to its database yet. Add <code>NEXT_PUBLIC_SUPABASE_URL</code>, <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> and <code>SUPABASE_SERVICE_ROLE_KEY</code> to the environment, then redeploy. See <code>docs/DEPLOYMENT.md</code>.</p>
      </div>
    </main>
  );
}
