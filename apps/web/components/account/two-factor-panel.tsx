'use client';

import type { DoneState } from '@hb/auth';
import { Alert, Badge, Button, CodeInput, Input, PasswordInput, SubmitButton } from '@hb/ui';
import Link from 'next/link';
import { useActionState, useState } from 'react';
import {
  disableTwoFactorAction,
  twoFactorAction,
  type TwoFactorPanelState,
} from '@/app/(shop)/account/actions';
import { FormAlert } from '@/components/auth/form-alert';
import { useFieldErrors } from '@/components/auth/use-field-errors';
import { checks } from '@/lib/validation';

function groupKey(secret: string): string {
  return secret.replace(/(.{4})/g, '$1 ').trim();
}

function BackupCodes({ codes, onDone }: { codes: string[]; onDone: (form: FormData) => void }) {
  const [copied, setCopied] = useState(false);
  const text = `Her Beauty backup codes (each works once)\n\n${codes.join('\n')}\n`;

  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'her-beauty-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-4">
      <Alert tone="success" title="Two-factor is on">
        Save these backup codes somewhere safe. Each one lets you log in once if you lose your
        phone. We won’t show them again.
      </Alert>
      <ul
        aria-label="Backup codes"
        className="grid grid-cols-2 gap-2 rounded-btn border border-gold-500 bg-blush-50 p-4 text-sm font-medium tabular-nums tracking-wider text-ink-900"
      >
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="secondary" size="sm" onClick={download}>
          Download codes
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={copy}>
          {copied ? 'Copied' : 'Copy codes'}
        </Button>
      </div>
      <form action={onDone}>
        <input type="hidden" name="intent" value="done" />
        <SubmitButton size="sm">I saved these codes</SubmitButton>
      </form>
    </div>
  );
}

function ScanStep({
  state,
  action,
}: {
  state: Extract<TwoFactorPanelState, { step: 'scan' }>;
  action: (form: FormData) => void;
}) {
  const v = useFieldErrors({ code: checks.code }, state.error ?? null);
  return (
    <div className="space-y-5">
      <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-500">
        <li>
          Open an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…).
        </li>
        <li>Scan the QR code, or type the key below.</li>
        <li>Enter the 6-digit code the app shows.</li>
      </ol>
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- server-made data URL, no optimisation needed */}
        <img
          src={state.qrDataUrl}
          alt="QR code for your authenticator app"
          width={176}
          height={176}
          className="rounded-btn border border-ink-200 bg-white p-2"
        />
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink-900">Can’t scan? Enter this key</p>
          <p className="mt-1 break-all text-sm tabular-nums tracking-wider text-ink-500">
            <span className="sr-only">Setup key: </span>
            {groupKey(state.secret)}
          </p>
        </div>
      </div>
      <form action={action} onSubmit={v.onSubmit} noValidate className="space-y-4">
        <FormAlert state={state.error ?? null} />
        <input type="hidden" name="intent" value="enable" />
        <CodeInput label="6-digit code" name="code" error={v.errorFor('code')} {...v.field} />
        <SubmitButton pendingLabel="Checking…">Turn on two-factor</SubmitButton>
      </form>
      <form action={action}>
        <input type="hidden" name="intent" value="cancel" />
        <Button type="submit" variant="ghost" size="sm">
          Cancel setup
        </Button>
      </form>
    </div>
  );
}

function DisableTwoFactor({ hasPassword }: { hasPassword: boolean }) {
  const [state, action] = useActionState<DoneState | null, FormData>(disableTwoFactorAction, null);
  const error = state?.status === 'error' ? state : null;
  const v = useFieldErrors({ password: checks.password, code: checks.secondFactor }, error);
  if (!hasPassword) {
    return (
      <p className="text-sm text-ink-500">
        To turn two-factor off, first{' '}
        <Link href="/forgot-password" className="font-medium text-pink-600 hover:underline">
          set a password
        </Link>
        .
      </p>
    );
  }
  return (
    <details className="group rounded-btn border border-ink-200 p-4">
      <summary className="cursor-pointer list-none text-sm font-medium text-ink-900 [&::-webkit-details-marker]:hidden">
        Turn off two-factor…
      </summary>
      <form action={action} onSubmit={v.onSubmit} noValidate className="mt-4 space-y-4">
        <p className="text-sm text-ink-500">
          Your account will be protected by your password only. Confirm with your password and a
          code.
        </p>
        <FormAlert state={state} />
        <PasswordInput
          label="Current password"
          name="password"
          autoComplete="current-password"
          error={v.errorFor('password')}
          {...v.field}
        />
        <Input
          label="Code from your app or a backup code"
          name="code"
          autoComplete="one-time-code"
          spellCheck={false}
          error={v.errorFor('code')}
          {...v.field}
        />
        <SubmitButton variant="secondary" pendingLabel="Turning off…">
          Turn off two-factor
        </SubmitButton>
      </form>
    </details>
  );
}

/** 2FA on/off: QR + manual key + first code, then backup codes shown once. */
export function TwoFactorPanel({
  enabled,
  hasPassword,
}: {
  enabled: boolean;
  hasPassword: boolean;
}) {
  const [state, action] = useActionState<TwoFactorPanelState, FormData>(twoFactorAction, null);

  let body;
  if (state?.step === 'codes') {
    body = <BackupCodes codes={state.backupCodes} onDone={action} />;
  } else if (state?.step === 'scan') {
    body = <ScanStep state={state} action={action} />;
  } else if (enabled) {
    body = <DisableTwoFactor hasPassword={hasPassword} />;
  } else {
    body = (
      <form action={action} className="space-y-4">
        {state?.step === 'failed' && <FormAlert state={state.error} />}
        <p className="text-sm text-ink-500">
          Add a code from an authenticator app when you log in with your password, so a stolen
          password alone can’t open your account.
        </p>
        <input type="hidden" name="intent" value="setup" />
        <SubmitButton variant="secondary" size="sm" pendingLabel="Preparing…">
          Turn on two-factor
        </SubmitButton>
      </form>
    );
  }

  const on = enabled || state?.step === 'codes';
  return (
    <section aria-labelledby="two-factor-heading" className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 id="two-factor-heading" className="font-sans text-base font-medium text-ink-900">
          Two-factor authentication
        </h3>
        <Badge kind={on ? 'success' : 'warning'}>{on ? 'On' : 'Off'}</Badge>
      </div>
      {body}
    </section>
  );
}
