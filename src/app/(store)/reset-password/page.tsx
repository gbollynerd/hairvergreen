import { AuthForm } from '@/components/auth/auth-form';
export const metadata = { title: 'Choose a new password', robots: { index: false } };
export default function Reset() {
  return (
    <div className="container-x max-w-lg py-14 md:py-20">
      <h1 className="display-2">Choose a new password</h1>
      <AuthForm mode="reset" />
    </div>
  );
}
