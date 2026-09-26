import type { Metadata } from 'next';
import Link from 'next/link';
import { ForgotPasswordForm } from '@/components/auth/password-reset-forms';

export const metadata: Metadata = { title: 'Reset your password' };

export default function SellerForgotPasswordPage() {
  return (
    <>
      <h1 className="font-display text-[34px] font-semibold leading-tight text-ink-900">
        Reset your password
      </h1>
      <p className="mt-2 text-ink-500">
        Enter the email or mobile number on your account and we’ll send you a 6-digit code.
      </p>
      <div className="mt-8">
        <ForgotPasswordForm />
      </div>
      <p className="mt-8 text-center text-sm text-ink-500">
        Remembered it?{' '}
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center font-medium text-pink-600 hover:underline"
        >
          Back to log in
        </Link>
      </p>
    </>
  );
}
