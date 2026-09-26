import { describe, expect, it } from 'vitest';
import { qrSvgDataUrl } from './qr';

describe('qrSvgDataUrl', () => {
  it('renders an SVG data URL for an otpauth URI', async () => {
    const url = await qrSvgDataUrl('otpauth://totp/Her%20Beauty:a?secret=JBSWY3DPEHPK3PXP');
    expect(url.startsWith('data:image/svg+xml;base64,')).toBe(true);
    const svg = Buffer.from(url.split(',')[1] ?? '', 'base64').toString('utf8');
    expect(svg).toContain('<svg');
  });

  it('refuses anything that is not an otpauth URI', async () => {
    await expect(qrSvgDataUrl('https://evil.test')).rejects.toThrow();
  });
});
