// Short-lived httpOnly state cookies: hb_<audience>_mfa (2FA challenge) and hb_<audience>_pending
// (code pages).
// Values are base64url JSON; anything that does not decode to the expected shape is ignored.
import type { OtpChannel } from '@hb/types';

/** "contact": a signed-in user confirming the email or mobile number on their account. */
export type PendingPurpose = 'login' | 'verify' | 'reset' | 'contact';

const PURPOSES: readonly string[] = [
  'login',
  'verify',
  'reset',
  'contact',
] satisfies PendingPurpose[];
const isPurpose = (v: unknown): v is PendingPurpose =>
  typeof v === 'string' && PURPOSES.includes(v);

export type PendingState = {
  v: 1;
  /** What the person typed (sent back to the API on verify/resend). */
  target: string;
  /** Masked copy for display. */
  display: string;
  channel: OtpChannel;
  purpose: PendingPurpose;
  /** ms since epoch of the last send, for the resend cooldown. */
  sentAt: number;
  next: string;
  /** A correct code kept while we ask for the person's name (PROFILE_REQUIRED keeps it valid). */
  code?: string;
};

export type MfaState = {
  v: 1;
  token: string;
  kind: 'mfa' | 'mfa_setup';
  next: string;
};

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): string | null {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) return null;
  try {
    const b64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

function decode(value: string | undefined): Record<string, unknown> | null {
  if (!value) return null;
  const json = fromBase64Url(value);
  if (json === null) return null;
  try {
    const parsed: unknown = JSON.parse(json);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

const str = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

export function encodeState(state: PendingState | MfaState): string {
  return toBase64Url(JSON.stringify(state));
}

export function decodePending(value: string | undefined): PendingState | null {
  const s = decode(value);
  if (!s || s.v !== 1) return null;
  if (!str(s.target) || !str(s.display) || !str(s.next)) return null;
  if (s.channel !== 'sms' && s.channel !== 'email') return null;
  if (!isPurpose(s.purpose)) return null;
  if (typeof s.sentAt !== 'number' || !Number.isFinite(s.sentAt)) return null;
  const state: PendingState = {
    v: 1,
    target: s.target,
    display: s.display,
    channel: s.channel,
    purpose: s.purpose,
    sentAt: s.sentAt,
    next: s.next,
  };
  if (str(s.code)) state.code = s.code;
  return state;
}

export function decodeMfa(value: string | undefined): MfaState | null {
  const s = decode(value);
  if (!s || s.v !== 1 || !str(s.token) || !str(s.next)) return null;
  if (s.kind !== 'mfa' && s.kind !== 'mfa_setup') return null;
  return { v: 1, token: s.token, kind: s.kind, next: s.next };
}
