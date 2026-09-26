import { describe, expect, it } from 'vitest';
import { ApiError } from '../common/errors';
import { maskIdentifier, normalisePhone, parseIdentifier, parseTarget } from './identifiers';

describe('identifiers', () => {
  it('normalises Pakistani mobile numbers to E.164', () => {
    for (const raw of [
      '03001234567',
      '3001234567',
      '+923001234567',
      '923001234567',
      '00923001234567',
      '0300 1234567',
      '+92 300-123-4567',
    ]) {
      expect(normalisePhone(raw)).toBe('+923001234567');
    }
  });

  it('rejects numbers that are not Pakistani mobiles', () => {
    for (const raw of ['0421234567', '+14155550100', '030012345', '030012345678', 'abc']) {
      expect(normalisePhone(raw)).toBeNull();
    }
  });

  it('trims and lower-cases emails', () => {
    expect(parseIdentifier('  Ayesha@Example.PK ')).toEqual({
      kind: 'email',
      value: 'ayesha@example.pk',
    });
    expect(parseIdentifier('0300 1234567')).toEqual({ kind: 'phone', value: '+923001234567' });
  });

  it('answers VALIDATION_FAILED for anything else', () => {
    for (const raw of ['not an email@', 'hello', '12345']) {
      try {
        parseIdentifier(raw);
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(ApiError);
        expect((e as ApiError).getStatus()).toBe(400);
        expect(JSON.stringify((e as ApiError).getResponse())).toContain('VALIDATION_FAILED');
      }
    }
  });

  it('requires the target to match the channel', () => {
    expect(() => parseTarget('sms', 'a@b.pk')).toThrow(ApiError);
    expect(() => parseTarget('email', '03001234567')).toThrow(ApiError);
    expect(parseTarget('sms', '03001234567').value).toBe('+923001234567');
  });

  it('masks emails and phones', () => {
    expect(maskIdentifier({ kind: 'email', value: 'ayesha@gmail.com' })).toBe('a•••@gmail.com');
    expect(maskIdentifier({ kind: 'phone', value: '+923001234567' })).toBe('+92 300 •••• 567');
  });
});
