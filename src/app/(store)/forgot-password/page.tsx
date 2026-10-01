import { AuthForm } from '@/components/auth/auth-form';
export const metadata = { title: 'Reset your password', robots: { index: false } };
export default function Forgot() {
  return (
    <div className="container-x max-w-lg py-14 md:py-20">
      <h1 className="display-2">Reset your password</h1>
      <p className="lede mt-3">Enter your email and we&apos;ll send you a secure link.</p>
      <AuthForm mode="forgot" />
    </div>
  );
}
