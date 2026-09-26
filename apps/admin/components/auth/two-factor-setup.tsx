'use client';

import { BackupCodeList, type AuthError } from '@hb/auth/client';
import { Alert, Button, CodeInput, FormAlert, SubmitButton, useFieldErrors } from '@hb/ui';
import Link from 'next/link';
import { useActionState, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { twoFactorSetupAction, type SetupState } from '@/app/login/actions';
import { TIMED_OUT } from '@/lib/auth-copy';
import { checks } from '@/lib/validation';
import { StartOver } from './auth-card';

type Action = (form: FormData) => void;

/** Failures where the sign-in step is still valid, so trying again can work. */
const RETRYABLE = new Set(['NETWORK', 'INTERNAL', 'BAD_RESPONSE', 'HTTP_ERROR', 'RATE_LIMITED']);

const SAVE_FIRST = 'Tick the box to confirm you saved your backup codes.';

function groupKey(secret: string): string {
  return secret.replace(/(.{4})/g, '$1 ').trim();
}

/**
 * First admin sign-in (docs/b2-auth.md §7): scan the QR code or type the key, confirm the first
 * code, then save the 10 backup codes (shown once) before the console opens.
 *
 * Enabling 2FA also signs the admin in, and setting those cookies makes Next re-render the page
 * without the setup challenge (`ready` turns false). The page keeps rendering this component in
 * the same place, so the backup codes held in its state survive that re-render. A reload does
 * lose them (the browser asks first): `alreadyOn` then says 2FA is on instead of "timed out".
 */
export function TwoFactorSetup({ ready, alreadyOn }: { ready: boolean; alreadyOn: boolean }) {
  const [state, action] = useActionState<SetupState, FormData>(twoFactorSetupAction, null);

  if (state?.step === 'codes') {
    return (
      <BackupCodes codes={state.backupCodes} unsaved={Boolean(state.unsaved)} action={action} />
    );
  }
  if (state?.step === 'scan') {
    return (
      <ScanStep
        secret={state.secret}
        qrDataUrl={state.qrDataUrl}
        error={state.error ?? null}
        action={action}
      />
    );
  }
  if (!ready) return alreadyOn ? <AlreadyOn /> : <StartOver message={TIMED_OUT} />;
  if (state?.step === 'failed' && !RETRYABLE.has(state.error.code)) {
    return <StartOver message={state.error.message} />;
  }
  return <Intro error={state?.step === 'failed' ? state.error : null} action={action} />;
}

function Heading({ children }: { children: string }) {
  return (
    <h1 className="font-display text-[28px] font-medium leading-tight text-ink-900">{children}</h1>
  );
}

function StartOverLink() {
  return (
    <p className="mt-4 text-center text-sm">
      <Link
        href="/login"
        className="inline-flex min-h-11 items-center text-ink-500 hover:text-ink-900 hover:underline"
      >
        Start over
      </Link>
    </p>
  );
}

/** Signed in with 2FA on, but the one-time backup codes are gone (the page was reloaded). */
function AlreadyOn() {
  return (
    <>
      <Heading>Two-step verification is on</Heading>
      <p className="mt-2 text-sm text-ink-500">
        You’re logged in, and every log-in now asks for a code from your authenticator app.
      </p>
      <p className="mt-3 text-sm text-ink-500">
        Backup codes are shown only once, right after setup, so we can’t show them here again. Your
        authenticator app keeps working for every log-in.
      </p>
      <Button asChild block className="mt-6">
        <Link href="/">Continue to the console</Link>
      </Button>
    </>
  );
}

function Intro({ error, action }: { error: AuthError | null; action: Action }) {
  return (
    <>
      <Heading>Set up two-step verification</Heading>
      <p className="mt-2 text-sm text-ink-500">
        Every admin logs in with a password and a code from an authenticator app. You only set this
        up once, and it takes about a minute.
      </p>
      <p className="mt-3 text-sm text-ink-500">
        Have your phone ready with an authenticator app, like Google Authenticator, Microsoft
        Authenticator or 1Password.
      </p>
      <form action={action} className="mt-6">
        <FormAlert state={error} />
        <input type="hidden" name="intent" value="start" />
        <SubmitButton block pendingLabel="Preparing…">
          Show QR code
        </SubmitButton>
      </form>
      <StartOverLink />
    </>
  );
}

function ScanStep({
  secret,
  qrDataUrl,
  error,
  action,
}: {
  secret: string;
  qrDataUrl: string;
  error: AuthError | null;
  action: Action;
}) {
  const v = useFieldErrors({ code: checks.code }, error);
  return (
    <>
      <Heading>Scan the QR code</Heading>
      <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-ink-500">
        <li>In your authenticator app, add an account.</li>
        <li>Scan the QR code, or enter the setup key.</li>
        <li>Enter the 6-digit code the app shows.</li>
      </ol>
      <div className="mt-6 flex flex-col items-center gap-4 rounded-btn border border-ink-200 p-4 sm:flex-row">
        {/* eslint-disable-next-line @next/next/no-img-element -- server-made SVG data URL, nothing to optimise */}
        <img
          src={qrDataUrl}
          alt="QR code that adds Her Beauty Admin to your authenticator app"
          width={160}
          height={160}
          className="h-40 w-40 shrink-0 bg-white"
        />
        <div className="min-w-0 self-stretch sm:self-auto">
          <p className="text-sm font-medium text-ink-900">Can’t scan? Enter this key</p>
          <p className="mt-1 break-words text-sm font-medium tabular-nums tracking-wider text-ink-500">
            <span className="sr-only">Setup key: </span>
            {groupKey(secret)}
          </p>
        </div>
      </div>
      <form action={action} onSubmit={v.onSubmit} noValidate className="mt-6 space-y-5">
        <FormAlert state={error} />
        <input type="hidden" name="intent" value="enable" />
        <CodeInput
          label="6-digit code"
          name="code"
          hint="Finish within 5 minutes of logging in."
          error={v.errorFor('code')}
          {...v.field}
        />
        <SubmitButton block pendingLabel="Checking…">
          Verify and turn on
        </SubmitButton>
      </form>
      <StartOverLink />
    </>
  );
}

function BackupCodes({
  codes,
  unsaved,
  action,
}: {
  codes: string[];
  unsaved: boolean;
  action: Action;
}) {
  const [checked, setChecked] = useState(false);
  const [triedEmpty, setTriedEmpty] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const checkboxId = useId();
  const errorId = `${checkboxId}-error`;
  const showError = !checked && (triedEmpty || unsaved);

  // The codes replace the form the person just used: move focus so screen readers announce them.
  useEffect(() => heading.current?.focus(), []);

  // The checkbox is `required`, so the browser blocks the submit; we show our own message.
  function onInvalid(e: FormEvent<HTMLInputElement>) {
    e.preventDefault();
    setTriedEmpty(true);
    e.currentTarget.focus();
  }

  return (
    <>
      <Alert tone="success" title="Two-step verification is on">
        One last step before the console opens.
      </Alert>
      <h1
        ref={heading}
        tabIndex={-1}
        className="mt-6 font-display text-[28px] font-medium leading-tight text-ink-900 focus:outline-none"
      >
        Save your backup codes
      </h1>
      <p className="mt-2 text-sm text-ink-500">
        If you lose your phone, each code lets you log in once. Keep them somewhere safe, like a
        password manager. We won’t show them again.
      </p>
      <BackupCodeList
        codes={codes}
        fileTitle="Her Beauty Admin backup codes"
        fileName="her-beauty-admin-backup-codes.txt"
        className="mt-5"
      />
      <form action={action} className="mt-6 space-y-5">
        <input type="hidden" name="intent" value="finish" />
        <div>
          <label
            htmlFor={checkboxId}
            className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-ink-900"
          >
            <input
              id={checkboxId}
              type="checkbox"
              name="saved"
              value="yes"
              required
              onInvalid={onInvalid}
              onChange={(e) => setChecked(e.currentTarget.checked)}
              aria-invalid={showError || undefined}
              aria-describedby={showError ? errorId : undefined}
              className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-pink-600"
            />
            <span>I saved these codes somewhere safe</span>
          </label>
          {showError && (
            <p id={errorId} role="alert" className="text-xs text-danger">
              {SAVE_FIRST}
            </p>
          )}
        </div>
        <SubmitButton block pendingLabel="Opening the console…">
          Continue to the console
        </SubmitButton>
      </form>
    </>
  );
}
