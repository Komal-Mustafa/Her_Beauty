import { Injectable, Logger } from '@nestjs/common';

/**
 * Outbound SMS / email (docs/b2-auth.md §4 "Delivery"). Real providers are a later phase
 * [CONFIRM provider]; everything that sends a message goes through this interface.
 */
export interface MessageProvider {
  sendSms(to: string, text: string): Promise<void>;
  sendEmail(to: string, subject: string, text: string): Promise<void>;
}

export const MESSAGE_PROVIDER = Symbol('MESSAGE_PROVIDER');

const maskTo = (to: string) =>
  to.includes('@') ? `${to.slice(0, 1)}•••${to.slice(to.lastIndexOf('@'))}` : `•••${to.slice(-3)}`;

/** Dev only: writes messages (including codes) to the Nest log. Refuses to exist in production. */
@Injectable()
export class LogMessageProvider implements MessageProvider {
  private readonly log = new Logger('Messages');

  constructor() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('LogMessageProvider must not be used in production');
    }
  }

  async sendSms(to: string, text: string) {
    this.log.log(`[dev sms to ${maskTo(to)}] ${text}`);
  }

  async sendEmail(to: string, subject: string, text: string) {
    this.log.log(`[dev email to ${maskTo(to)}] ${subject} — ${text}`);
  }
}

export interface OutboxMessage {
  channel: 'sms' | 'email';
  to: string;
  subject: string | null;
  text: string;
  at: Date;
}

/** Tests: keeps every message in memory so tests can read codes out of the outbox. */
@Injectable()
export class MemoryMessageProvider implements MessageProvider {
  readonly outbox: OutboxMessage[] = [];

  async sendSms(to: string, text: string) {
    this.outbox.push({ channel: 'sms', to, subject: null, text, at: new Date() });
  }

  async sendEmail(to: string, subject: string, text: string) {
    this.outbox.push({ channel: 'email', to, subject, text, at: new Date() });
  }

  /** Every message sent to `to`, oldest first. */
  to(to: string): OutboxMessage[] {
    return this.outbox.filter((m) => m.to === to);
  }

  last(to: string): OutboxMessage | undefined {
    return this.to(to).at(-1);
  }

  /** The 6-digit code in the latest message to `to`, if any. */
  lastCode(to: string): string | undefined {
    return /\b(\d{6})\b/.exec(this.last(to)?.text ?? '')?.[1];
  }

  clear() {
    this.outbox.length = 0;
  }
}
