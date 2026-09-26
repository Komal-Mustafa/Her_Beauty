import { Button, Input, Logo, TrustStrip } from '@hb/ui';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Log in' };

/*
 * P1 shell of the seller login (04-ui-ux §6.5 split screen).
 * P7 adds validation, OTP/2FA flow and the slow 3D compact on the left panel.
 */
export default function SellerLoginPage() {
  return (
    <main id="main" className="grid min-h-dvh md:grid-cols-2">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-grad-pink p-12 md:flex">
        <Logo />
        <div className="max-w-md animate-rise">
          <p className="eyebrow mb-3 text-gold-800">Seller portal</p>
          <h1 className="font-display text-[56px] font-semibold leading-[1.05] text-ink-900">
            Grow your beauty brand with <span className="text-grad-rose">Her Beauty</span>
          </h1>
        </div>
        <TrustStrip compact />
      </section>
      <section className="flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm">
          <div className="mb-10 md:hidden">
            <Logo />
          </div>
          <h2 className="font-display text-[34px] font-semibold text-ink-900">Welcome back</h2>
          <p className="mt-2 text-ink-500">Log in to manage your products, orders and ads.</p>
          <form className="mt-8 space-y-5" action="/login" method="post" noValidate>
            <Input label="Email or mobile" name="identifier" autoComplete="username" required />
            <Input
              label="Password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-sm text-pink-600 hover:underline">
                Forgot password?
              </Link>
            </div>
            <Button type="submit" block>
              Log in
            </Button>
          </form>
          <p className="mt-8 text-center text-sm text-ink-500">
            New to Her Beauty?{' '}
            <Link href="/register" className="font-medium text-pink-600 hover:underline">
              Register as a vendor or manufacturer
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
