import { randomInt } from 'node:crypto';
import type { INestApplication, ModuleMetadata } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { decodeJwt } from 'jose';
import { Secret, TOTP } from 'otpauth';
import request from 'supertest';
import { z } from 'zod';
import type { PrismaClient } from '@hb/db';
import { LoginResult, type AuthAudience } from '@hb/types';
import { AppModule } from '../src/app.module';
import { CaptchaService } from '../src/auth/captcha.service';
import { configureApp } from '../src/bootstrap';
import { APP_CONFIG, type AppConfig } from '../src/config/config';
import { MemoryMessageProvider, MESSAGE_PROVIDER } from '../src/messaging/message-provider';

export const hasDb = Boolean(process.env.DATABASE_URL);

/** Turnstile token the stubbed CAPTCHA accepts; anything else fails. */
export const CAPTCHA_PASS = 'test-captcha-pass';

class StubCaptchaService extends CaptchaService {
  protected override async verifyToken(token: string): Promise<boolean> {
    return token === CAPTCHA_PASS;
  }
}

export interface TestApp {
  app: INestApplication;
  outbox: MemoryMessageProvider;
}

/** The real app (same bootstrap as main.ts) with an in-memory outbox and a stubbed Turnstile. */
export async function createTestApp(
  extraImports: ModuleMetadata['imports'] = [],
): Promise<TestApp> {
  const outbox = new MemoryMessageProvider();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule, ...extraImports] })
    .overrideProvider(MESSAGE_PROVIDER)
    .useValue(outbox)
    .overrideProvider(CaptchaService)
    .useFactory({
      factory: (config: AppConfig) => new StubCaptchaService(config),
      inject: [APP_CONFIG],
    })
    .compile();
  const app = configureApp(moduleRef.createNestApplication({ logger: false }));
  await app.init();
  return { app, outbox };
}

export const ErrorBody = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.unknown()),
  }),
});

// ---------- unique test data (cleaned up by `cleanup`) ----------

const RUN = `${Date.now().toString(36)}${randomInt(1_000).toString(36)}`;
const IP_BASE = randomInt(0, 200);
let counter = 0;
const phones = new Set<string>();
const ips = new Set<string>();

/** A fresh client IP per call, so per-IP limits never collide between tests. */
export function nextIp(): string {
  counter += 1;
  const ip = `10.${IP_BASE}.${Math.floor(counter / 250) % 250}.${(counter % 250) + 1}`;
  ips.add(ip);
  return ip;
}

export function uniqueEmail(tag = 'user'): string {
  counter += 1;
  return `${tag}-${RUN}-${counter}@b2.test`;
}

/** A valid Pakistani mobile number in local format (0300 ...), plus its E.164 form. */
export function uniquePhone(): { local: string; e164: string } {
  const national = `3${String(randomInt(0, 1_000_000_000)).padStart(9, '0')}`;
  const e164 = `+92${national}`;
  phones.add(e164);
  return { local: `0${national}`, e164 };
}

export const STRONG_PASSWORD = 'Velvet-Rose-Compact-2026';

/** Remove every row the auth tests created. audit_logs are append-only only for `app_user`. */
export async function cleanup(db: PrismaClient): Promise<void> {
  const users = await db.user.findMany({
    where: { OR: [{ email: { endsWith: '@b2.test' } }, { phone: { in: [...phones] } }] },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);
  const sellers = await db.seller.findMany({
    where: { ownerUserId: { in: userIds } },
    select: { id: true },
  });
  const sellerIds = sellers.map((s) => s.id);
  await db.product.deleteMany({ where: { sellerId: { in: sellerIds } } });
  await db.auditLog.deleteMany({
    where: {
      OR: [
        { actorId: { in: userIds } },
        { targetId: { in: [...userIds, ...sellerIds] } },
        { ip: { in: [...ips] } },
      ],
    },
  });
  await db.seller.deleteMany({ where: { id: { in: sellerIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.otpCode.deleteMany({
    where: {
      OR: [
        { target: { endsWith: '@b2.test' } },
        { target: { in: [...phones] } },
        { requestIp: { in: [...ips] } },
      ],
    },
  });
}

// ---------- HTTP helpers ----------

export class Api {
  constructor(private readonly app: INestApplication) {}

  /** Plain supertest agent (no X-Forwarded-For): the client IP is the loopback socket. */
  raw() {
    return request(this.app.getHttpServer());
  }

  private agent() {
    return this.raw();
  }

  post(path: string, body: object = {}, opts: { ip?: string; token?: string; ua?: string } = {}) {
    const req = this.agent()
      .post(`/v1${path}`)
      .set('X-Forwarded-For', opts.ip ?? nextIp());
    if (opts.token) req.set('Authorization', `Bearer ${opts.token}`);
    if (opts.ua) req.set('User-Agent', opts.ua);
    return req.send(body);
  }

  get(path: string, token?: string, ip = nextIp()) {
    const req = this.agent().get(`/v1${path}`).set('X-Forwarded-For', ip);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  }

  patch(path: string, body: object, token?: string) {
    const req = this.agent().patch(`/v1${path}`).set('X-Forwarded-For', nextIp());
    if (token) req.set('Authorization', `Bearer ${token}`);
    return req.send(body);
  }

  delete(path: string, token?: string) {
    const req = this.agent().delete(`/v1${path}`).set('X-Forwarded-For', nextIp());
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  }
}

export type LoginOk = Extract<LoginResult, { status: 'ok' }>;

export function expectOk(body: unknown): LoginOk {
  const result = LoginResult.parse(body);
  if (result.status !== 'ok') throw new Error(`expected status ok, got ${result.status}`);
  return result;
}

export function claims(accessToken: string) {
  return decodeJwt(accessToken);
}

/** TOTP code for `secret` at now + `stepOffset` × 30 s. */
export function totp(secret: string, stepOffset = 0): string {
  return TOTP.generate({
    secret: Secret.fromBase32(secret),
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    timestamp: Date.now() + stepOffset * 30_000,
  });
}

/** Register through the API, read the code from the outbox, verify, return the login. */
export async function registerAndVerify(
  api: Api,
  outbox: MemoryMessageProvider,
  input: {
    audience: AuthAudience;
    email: string;
    phone?: string;
    password?: string;
    fullName?: string;
    sellerType?: 'vendor' | 'manufacturer';
    storeName?: string;
  },
): Promise<LoginOk> {
  const body =
    input.audience === 'seller'
      ? {
          audience: 'seller',
          sellerType: input.sellerType ?? 'vendor',
          storeName: input.storeName ?? 'Test Glow Studio',
          fullName: input.fullName ?? 'Test Seller',
          email: input.email,
          phone: input.phone ?? uniquePhone().local,
          password: input.password ?? STRONG_PASSWORD,
        }
      : {
          audience: 'web',
          fullName: input.fullName ?? 'Test Customer',
          email: input.email,
          ...(input.phone ? { phone: input.phone } : {}),
          password: input.password ?? STRONG_PASSWORD,
        };
  await api.post('/auth/register', body).expect(202);
  const code = outbox.lastCode(input.email);
  if (!code) throw new Error('no verification code in the outbox');
  const res = await api
    .post('/auth/otp/verify', {
      audience: input.audience,
      channel: 'email',
      target: input.email,
      purpose: 'verify',
      code,
    })
    .expect(200);
  return expectOk(res.body);
}

export function passwordLogin(
  api: Api,
  identifier: string,
  audience: AuthAudience = 'web',
  password = STRONG_PASSWORD,
  opts: { ip?: string; ua?: string } = {},
) {
  return api.post('/auth/login', { audience, identifier, password }, opts);
}
