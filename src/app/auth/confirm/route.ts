import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createSupabaseServer } from '@/lib/supabase/server';
import { safeRedirectPath } from '@/lib/utils';

// Email confirmation / password recovery / invite links (token_hash flow).
export async function GET(req: NextRequest) {
  const token_hash = req.nextUrl.searchParams.get('token_hash');
  const type = req.nextUrl.searchParams.get('type') as EmailOtpType | null;
  const fallback = type === 'recovery' || type === 'invite' ? '/reset-password' : '/account';
  const next = safeRedirectPath(req.nextUrl.searchParams.get('next'), fallback);
  if (token_hash && type) {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) return NextResponse.redirect(new URL(next, req.url));
  }
  return NextResponse.redirect(new URL('/login?error=link', req.url));
}
