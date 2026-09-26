import QRCode from 'qrcode';

/**
 * Server-side QR code for a TOTP `otpauth://` URI, as an SVG data URL for an <img> (CSP allows
 * `img-src data:`). The secret never leaves the server except inside this image and the manual
 * key the page shows next to it.
 */
export async function qrSvgDataUrl(otpauthUri: string): Promise<string> {
  if (!otpauthUri.startsWith('otpauth://')) {
    throw new Error('qrSvgDataUrl expects an otpauth:// URI.');
  }
  const svg = await QRCode.toString(otpauthUri, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 2,
  });
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}
