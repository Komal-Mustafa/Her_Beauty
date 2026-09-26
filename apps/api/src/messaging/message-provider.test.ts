import { afterEach, describe, expect, it } from 'vitest';
import { LogMessageProvider, MemoryMessageProvider } from './message-provider';

describe('message providers', () => {
  const env = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = env;
  });

  it('the log provider refuses to exist in production', () => {
    process.env.NODE_ENV = 'production';
    expect(() => new LogMessageProvider()).toThrow(/production/);
    process.env.NODE_ENV = 'development';
    expect(() => new LogMessageProvider()).not.toThrow();
  });

  it('the memory provider keeps an outbox tests can read codes from', async () => {
    const outbox = new MemoryMessageProvider();
    await outbox.sendSms('+923001234567', 'Your Her Beauty sign-in code is 042917.');
    await outbox.sendEmail('a@b.pk', 'Hello', 'No code here.');
    expect(outbox.lastCode('+923001234567')).toBe('042917');
    expect(outbox.lastCode('a@b.pk')).toBeUndefined();
    expect(outbox.to('a@b.pk')[0]).toMatchObject({ channel: 'email', subject: 'Hello' });
    outbox.clear();
    expect(outbox.outbox).toHaveLength(0);
  });
});
