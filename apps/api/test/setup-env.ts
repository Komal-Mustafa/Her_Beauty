// Environment for every API test file (vitest `setupFiles`). Tests never depend on a developer's
// .env: fixed, clearly-fake secrets; no JWT keys, so the API makes an ephemeral Ed25519 pair.
process.env.NODE_ENV = 'test';
delete process.env.JWT_PRIVATE_KEY;
delete process.env.JWT_PUBLIC_KEY;
process.env.REFRESH_TOKEN_PEPPER = 'test-only-refresh-pepper-not-a-secret';
process.env.OTP_PEPPER = 'test-only-otp-pepper-not-a-secret';
process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
// Supertest connects over loopback, so X-Forwarded-For sets the client IP per request.
process.env.TRUST_PROXY = 'loopback';
// CAPTCHA on (as in production); the auth tests stub the Turnstile network call.
process.env.TURNSTILE_SECRET_KEY = 'test-only-turnstile-secret';
process.env.HIBP_ENABLED = 'false';
