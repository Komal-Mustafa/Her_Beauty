// Copy shared by the server helpers (field errors on a failed action) and the client forms in
// @hb/auth/client (blur-first checks), so both always say the same thing. Pure: safe on the
// server, at the edge and in the browser.

/** Inline field messages. Never blame the person; say what a valid value looks like. */
export const FIELD_MESSAGES = {
  identifier: 'Enter the email or mobile number you signed up with.',
  password: 'Enter your password.',
  newPassword: 'Use 8 to 128 characters.',
  fullName: 'Enter your name, at least 2 letters.',
  email: 'Enter an email like name@example.com.',
  phone: 'Enter a mobile number like 0300 1234567.',
  code: 'Enter the 6-digit code.',
  secondFactor: 'Enter the 6-digit code from your app, or a backup code.',
  emailOrPhone: 'Add an email or a mobile number so we can send your code.',
  storeName: 'Enter a store name, at least 2 characters.',
  sellerType: 'Choose Vendor or Manufacturer.',
  id: 'Refresh the page and try again.',
} as const;

/**
 * INVALID_CODE for authenticator-app and backup codes. The generic INVALID_CODE copy talks about a
 * message we sent, which is wrong here: nothing is sent and there is nothing to resend.
 */
export const SECOND_FACTOR_CODE_MESSAGES = {
  /** Log-in step and "turn off two-factor": an app code or a backup code. */
  challenge:
    'That code didn’t work. Enter the newest code from your authenticator app, or a backup code you haven’t used yet.',
  /** First code while turning two-factor on: only the app works here. */
  enable:
    'That code didn’t work. Enter the newest 6-digit code your authenticator app shows for Her Beauty.',
} as const;

/** Seconds before "Resend code" works again. */
export const RESEND_COOLDOWN_SEC = 60;
