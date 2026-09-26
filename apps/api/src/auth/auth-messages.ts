// Texts for every auth message. Codes appear only in the message body, never in logs.

export type CodePurpose = 'login' | 'verify' | 'reset' | 'contact';

const WHAT: Record<CodePurpose, string> = {
  login: 'sign-in',
  verify: 'verification',
  reset: 'password reset',
  contact: 'confirmation',
};

export interface MessageText {
  subject: string;
  text: string;
}

export function codeMessage(purpose: CodePurpose, code: string, ttlMinutes: number): MessageText {
  return {
    subject: `Your Her Beauty ${WHAT[purpose]} code`,
    text:
      `Your Her Beauty ${WHAT[purpose]} code is ${code}. It expires in ${ttlMinutes} minutes. ` +
      'Never share this code with anyone, including Her Beauty staff.',
  };
}

export const signUpNotice: MessageText = {
  subject: 'Someone tried to sign up with your address',
  text:
    'Someone tried to create a Her Beauty account with this address, but you already have one. ' +
    'If it was you, log in or reset your password. If not, you can ignore this message.',
};

export function lockNotice(minutes: number): MessageText {
  return {
    subject: 'Your Her Beauty account is temporarily locked',
    text:
      `After several failed sign-in attempts we locked your account for ${minutes} ` +
      `minute${minutes === 1 ? '' : 's'}. If this wasn't you, reset your password once the lock ends.`,
  };
}

/** Sent to the account's other confirmed address when a new sign-in identifier is confirmed. */
export function identifierAddedNotice(kind: 'email' | 'phone', masked: string): MessageText {
  const what = kind === 'email' ? 'email address' : 'mobile number';
  return {
    subject: `A ${what} was added to your Her Beauty account`,
    text:
      `The ${what} ${masked} was confirmed on your Her Beauty account and can now be used to log in. ` +
      'If this wasn’t you, reset your password and contact Her Beauty support.',
  };
}
