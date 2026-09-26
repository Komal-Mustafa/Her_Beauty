// @hb/auth/client — client-safe auth UI for the web, seller and admin apps (docs/b2-auth.md §7).
// Forms and panels take the app's server actions as props, so each app keeps its own redirects
// and copy. Nothing here may import the server-only "@hb/auth" entry (core, cookies, qr): only
// pure modules and result types (see client-entry.test.ts). Server-compatible pieces (SessionList,
// ContactRow, describeUserAgent) have no 'use client' and render from server components too.
export { BackupCodeList } from './backup-code-list';
export { Captcha } from './captcha';
export { authChecks, otpCodeCheck, secondFactorCheck } from './checks';
export { ContactRow } from './contact-row';
export { ForgotPasswordForm, ResetPasswordForm } from './password-reset-forms';
export { ResendCode } from './resend-code';
export { SessionList } from './session-list';
export { RevokeSessionButton, SignOutEverywhere } from './session-controls';
export { TwoFactorForm } from './two-factor-form';
export { TwoFactorPanel } from './two-factor-panel';
export type { FormAction } from './types';
export { describeUserAgent, formatDateTime } from './user-agent';
export { VerifyContactButton } from './verify-contact-button';
export { FIELD_MESSAGES, RESEND_COOLDOWN_SEC, SECOND_FACTOR_CODE_MESSAGES } from '../copy';
export type {
  AuthError,
  CodeSentState,
  DoneState,
  FieldErrors,
  LoginResultState,
  ProfileState,
  RegisterResultState,
  TwoFactorPanelState,
  VerifyResultState,
} from '../results';
