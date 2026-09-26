import { z } from 'zod';
import { Id, IsoDateTime } from './common';
import { SellerType } from './catalog';

// B2 accounts + login contract. Design: docs/b2-auth.md. The API validates every request with these
// schemas (.strict() on the server) and the Next.js apps parse every response with them.

/** Which app a session belongs to (docs/b2-auth.md §1). */
export const AuthAudience = z.enum(['web', 'seller', 'admin']);
export type AuthAudience = z.infer<typeof AuthAudience>;

export const UserRole = z.enum([
  'customer',
  'seller',
  'support',
  'finance',
  'admin',
  'super_admin',
]);
export type UserRole = z.infer<typeof UserRole>;

/** Roles allowed into the admin app. */
export const ADMIN_ROLES = [
  'support',
  'finance',
  'admin',
  'super_admin',
] as const satisfies readonly UserRole[];

export const SellerMemberRole = z.enum(['owner', 'manager', 'catalog', 'orders', 'finance']);
export type SellerMemberRole = z.infer<typeof SellerMemberRole>;

export const SellerStatus = z.enum([
  'draft',
  'submitted',
  'changes_requested',
  'approved',
  'rejected',
  'suspended',
]);
export type SellerStatus = z.infer<typeof SellerStatus>;

export const Email = z.string().trim().toLowerCase().pipe(z.email().max(254));
/** Loose on input; the API normalises to E.164 (+92 default) and rejects anything else. */
export const PhoneInput = z
  .string()
  .trim()
  .regex(/^\+?[0-9][0-9 -]{6,18}$/, 'Enter a mobile number like 0300 1234567');
/** Email or mobile number. */
export const Identifier = z.string().trim().min(3).max(254);
export const Password = z.string().min(8).max(128);
export const FullName = z.string().trim().min(2).max(120);
export const StoreName = z.string().trim().min(2).max(80);
export const OtpCode = z.string().regex(/^[0-9]{6}$/, 'Enter the 6-digit code');
/** A 6-digit TOTP code or a backup code (XXXXX-XXXXX, dash optional). */
export const SecondFactorCode = z
  .string()
  .trim()
  .regex(/^([0-9]{6}|[0-9A-Za-z]{5}-?[0-9A-Za-z]{5})$/, 'Enter the 6-digit code or a backup code');
export const OtpChannel = z.enum(['sms', 'email']);
export type OtpChannel = z.infer<typeof OtpChannel>;
export const OtpPurpose = z.enum(['login', 'verify']);
export type OtpPurpose = z.infer<typeof OtpPurpose>;

// ---------- responses ----------

export const TokenPair = z.object({
  accessToken: z.string().min(1),
  accessExpiresAt: IsoDateTime,
  refreshToken: z.string().min(1),
  refreshExpiresAt: IsoDateTime,
});
export type TokenPair = z.infer<typeof TokenPair>;

export const SellerMembership = z.object({
  sellerId: Id,
  role: SellerMemberRole,
  type: SellerType,
  status: SellerStatus,
  storeName: z.string().nullable(),
  slug: z.string().nullable(),
});
export type SellerMembership = z.infer<typeof SellerMembership>;

export const Me = z.object({
  id: Id,
  fullName: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  emailVerified: z.boolean(),
  phoneVerified: z.boolean(),
  role: UserRole,
  hasPassword: z.boolean(),
  twoFactorEnabled: z.boolean(),
  seller: SellerMembership.nullable(),
  createdAt: IsoDateTime,
});
export type Me = z.infer<typeof Me>;

export const LoginResult = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), tokens: TokenPair, user: Me }),
  z.object({
    status: z.literal('mfa_required'),
    challengeToken: z.string().min(1),
    expiresInSec: z.number().int().positive(),
  }),
  z.object({
    status: z.literal('mfa_setup_required'),
    challengeToken: z.string().min(1),
    expiresInSec: z.number().int().positive(),
  }),
]);
export type LoginResult = z.infer<typeof LoginResult>;

export const VerificationSent = z.object({
  status: z.literal('verification_sent'),
  channel: OtpChannel,
  /** Masked, e.g. "a•••@gmail.com" or "+92 300 •••• 567". */
  target: z.string(),
});
export type VerificationSent = z.infer<typeof VerificationSent>;

export const CodeSent = z.object({
  status: z.literal('sent'),
  expiresInSec: z.number().int().positive(),
});
export type CodeSent = z.infer<typeof CodeSent>;

export const TwoFactorSetup = z.object({
  secret: z.string().min(16),
  otpauthUri: z.string().startsWith('otpauth://totp/'),
});
export type TwoFactorSetup = z.infer<typeof TwoFactorSetup>;

export const TwoFactorEnabled = z.object({
  backupCodes: z.array(z.string()).length(10),
  /** Present when enrolment finished a login (admin first sign-in). */
  login: LoginResult.optional(),
});
export type TwoFactorEnabled = z.infer<typeof TwoFactorEnabled>;

export const SessionInfo = z.object({
  id: Id,
  audience: AuthAudience,
  userAgent: z.string().nullable(),
  ip: z.string().nullable(),
  createdAt: IsoDateTime,
  lastUsedAt: IsoDateTime.nullable(),
  current: z.boolean(),
});
export type SessionInfo = z.infer<typeof SessionInfo>;

export const SellerProfile = z.object({
  id: Id,
  type: SellerType,
  status: SellerStatus,
  storeName: z.string().nullable(),
  slug: z.string().nullable(),
  onboardingStep: z.number().int().min(1).max(9),
  submittedAt: IsoDateTime.nullable(),
  approvedAt: IsoDateTime.nullable(),
  reviewNote: z.string().nullable(),
  role: SellerMemberRole,
});
export type SellerProfile = z.infer<typeof SellerProfile>;

export const SellerProductRow = z.object({
  id: Id,
  slug: z.string(),
  title: z.string(),
  status: z.enum(['draft', 'pending_review', 'live', 'blocked', 'archived']),
  updatedAt: IsoDateTime,
});
export type SellerProductRow = z.infer<typeof SellerProductRow>;

export const AdminOverview = z.object({
  sellers: z.record(SellerStatus, z.number().int().nonnegative()),
  liveProducts: z.number().int().nonnegative(),
  users: z.number().int().nonnegative(),
  orders: z.number().int().nonnegative(),
});
export type AdminOverview = z.infer<typeof AdminOverview>;

// ---------- requests ----------

export const RegisterRequest = z.discriminatedUnion('audience', [
  z.object({
    audience: z.literal('web'),
    fullName: FullName,
    email: Email.optional(),
    phone: PhoneInput.optional(),
    password: Password,
    captchaToken: z.string().max(2048).optional(),
  }),
  z.object({
    audience: z.literal('seller'),
    sellerType: SellerType,
    storeName: StoreName,
    fullName: FullName,
    email: Email,
    phone: PhoneInput,
    password: Password,
    captchaToken: z.string().max(2048).optional(),
  }),
]);
export type RegisterRequest = z.infer<typeof RegisterRequest>;

export const LoginRequest = z.object({
  audience: AuthAudience,
  identifier: Identifier,
  password: z.string().min(1).max(128),
  captchaToken: z.string().max(2048).optional(),
});
export type LoginRequest = z.infer<typeof LoginRequest>;

export const OtpSendRequest = z.object({
  audience: AuthAudience,
  channel: OtpChannel,
  /** Email for channel "email", mobile number for "sms". */
  target: Identifier,
  purpose: OtpPurpose,
  captchaToken: z.string().max(2048).optional(),
});
export type OtpSendRequest = z.infer<typeof OtpSendRequest>;

export const OtpVerifyRequest = z.object({
  audience: AuthAudience,
  channel: OtpChannel,
  target: Identifier,
  purpose: OtpPurpose,
  code: OtpCode,
  /** Only for purpose "login" when no account exists yet (answer to PROFILE_REQUIRED). */
  fullName: FullName.optional(),
});
export type OtpVerifyRequest = z.infer<typeof OtpVerifyRequest>;

export const TwoFactorChallengeRequest = z.object({
  challengeToken: z.string().min(1).max(4096),
  code: SecondFactorCode,
});
export type TwoFactorChallengeRequest = z.infer<typeof TwoFactorChallengeRequest>;

/** Bearer-authenticated callers send {}; admin first sign-in sends the setup challenge token. */
export const TwoFactorSetupRequest = z.object({
  challengeToken: z.string().min(1).max(4096).optional(),
});
export type TwoFactorSetupRequest = z.infer<typeof TwoFactorSetupRequest>;

export const TwoFactorEnableRequest = z.object({
  challengeToken: z.string().min(1).max(4096).optional(),
  code: OtpCode,
});
export type TwoFactorEnableRequest = z.infer<typeof TwoFactorEnableRequest>;

export const TwoFactorDisableRequest = z.object({
  password: z.string().min(1).max(128),
  code: SecondFactorCode,
});
export type TwoFactorDisableRequest = z.infer<typeof TwoFactorDisableRequest>;

export const RefreshRequest = z.object({ refreshToken: z.string().min(1).max(512) });
export type RefreshRequest = z.infer<typeof RefreshRequest>;

export const LogoutRequest = RefreshRequest;
export type LogoutRequest = z.infer<typeof LogoutRequest>;

export const ForgotPasswordRequest = z.object({
  audience: AuthAudience,
  identifier: Identifier,
  captchaToken: z.string().max(2048).optional(),
});
export type ForgotPasswordRequest = z.infer<typeof ForgotPasswordRequest>;

export const ResetPasswordRequest = z.object({
  identifier: Identifier,
  code: OtpCode,
  newPassword: Password,
});
export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequest>;

export const UpdateMeRequest = z.object({ fullName: FullName });
export type UpdateMeRequest = z.infer<typeof UpdateMeRequest>;

export const StartSellerApplicationRequest = z.object({
  type: SellerType,
  storeName: StoreName,
});
export type StartSellerApplicationRequest = z.infer<typeof StartSellerApplicationRequest>;

/** Error codes the auth endpoints return in {error:{code}} (docs/b2-auth.md §4). */
export const AuthErrorCode = z.enum([
  'INVALID_CREDENTIALS',
  'INVALID_CODE',
  'WEAK_PASSWORD',
  'PROFILE_REQUIRED',
  'RATE_LIMITED',
  'UNAUTHENTICATED',
  'SESSION_REVOKED',
  'FORBIDDEN',
  'MFA_REQUIRED',
  'CONFLICT',
  'VALIDATION_FAILED',
]);
export type AuthErrorCode = z.infer<typeof AuthErrorCode>;
