import { Logger } from '@nestjs/common';
import { beforeAll, describe, expect, it } from 'vitest';
import { ApiError } from '../common/errors';
import { loadConfig } from '../config/config';
import { CaptchaService } from './captcha.service';

describe('CaptchaService', () => {
  beforeAll(() => Logger.overrideLogger(false));

  it('is skipped entirely without TURNSTILE_SECRET_KEY', async () => {
    const off = new CaptchaService(loadConfig({ NODE_ENV: 'test' }));
    for (let i = 0; i < 10; i++) off.recordFailure('10.9.9.9');
    expect(off.isRequired('10.9.9.9')).toBe(false);
    await expect(off.assertSolved('10.9.9.9', undefined)).resolves.toBeUndefined();
  });

  it('is required for an IP after 5 failures, and only for that IP', async () => {
    const on = new CaptchaService(loadConfig({ NODE_ENV: 'test', TURNSTILE_SECRET_KEY: 's' }));
    for (let i = 0; i < 4; i++) on.recordFailure('10.9.9.1');
    expect(on.isRequired('10.9.9.1')).toBe(false);
    on.recordFailure('10.9.9.1');
    expect(on.isRequired('10.9.9.1')).toBe(true);
    expect(on.isRequired('10.9.9.2')).toBe(false);
    await expect(on.assertSolved('10.9.9.1', undefined)).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof ApiError && JSON.stringify(e.getResponse()).includes('"captchaRequired":true'),
    );
  });
});
