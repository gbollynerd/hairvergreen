// Centralised, typed access to environment variables.
// Server-only secrets are read lazily so a missing optional secret never breaks the build.

export const env = {
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, ''),
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '',
  paystackPublicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || '',
};

export function serverEnv() {
  if (typeof window !== 'undefined') throw new Error('serverEnv() called in the browser');
  return {
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '',
    paystackSecretKey: process.env.PAYSTACK_SECRET_KEY || '',
    resendApiKey: process.env.RESEND_API_KEY || '',
    emailFrom: process.env.EMAIL_FROM || 'Hairver Green <orders@hairvergreen.com>',
    bootstrapAdmins: (process.env.BOOTSTRAP_SUPER_ADMIN_EMAILS || '')
      .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
    cronSecret: process.env.CRON_SECRET || '',
  };
}

export const isConfigured = () => Boolean(env.supabaseUrl && env.supabaseAnonKey);
