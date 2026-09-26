import { RequestMethod, type INestApplication } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { DiscoveryModule, DiscoveryService, Reflector } from '@nestjs/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createPrismaClient, uuidv7 } from '@hb/db';
import { Me, Page, SellerProductRow, SellerProfile, TokenPair } from '@hb/types';
import { IS_PUBLIC } from '../src/auth/decorators';
import type { MemoryMessageProvider } from '../src/messaging/message-provider';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  Api,
  cleanup,
  claims,
  createTestApp,
  ErrorBody,
  expectOk,
  hasDb,
  passwordLogin,
  registerAndVerify,
  uniqueEmail,
} from './helpers';

/** Default-deny guard, seller scoping (IDOR + RLS), seller applications (docs/b2-auth.md §5). */
describe.skipIf(!hasDb)('access control', () => {
  let app: INestApplication;
  let outbox: MemoryMessageProvider;
  let api: Api;
  const db = createPrismaClient();

  beforeAll(async () => {
    ({ app, outbox } = await createTestApp([DiscoveryModule]));
    api = new Api(app);
  });

  afterAll(async () => {
    await cleanup(db);
    await db.$disconnect();
    await app?.close();
  });

  describe('default deny', () => {
    type Route = { method: string; path: string; isPublic: boolean };

    function routes(): Route[] {
      const reflector = app.get(Reflector);
      const out: Route[] = [];
      for (const wrapper of app.get(DiscoveryService).getControllers()) {
        const { instance, metatype } = wrapper;
        if (!instance || !metatype) continue;
        const base = String(Reflect.getMetadata(PATH_METADATA, metatype) ?? '');
        const proto: object = Object.getPrototypeOf(instance);
        for (const name of Object.getOwnPropertyNames(proto)) {
          const handler: unknown = Reflect.get(proto, name);
          if (name === 'constructor' || typeof handler !== 'function') continue;
          const path: unknown = Reflect.getMetadata(PATH_METADATA, handler);
          if (path === undefined) continue;
          const method = RequestMethod[Reflect.getMetadata(METHOD_METADATA, handler) as number];
          const isPublic =
            reflector.getAllAndOverride<boolean>(IS_PUBLIC, [handler, metatype]) === true;
          const full = `/${[base, String(path)].filter((p) => p && p !== '/').join('/')}`
            .replace(/\/+/g, '/')
            .replace(/:[A-Za-z]+/g, uuidv7());
          out.push({ method: String(method), path: full, isPublic });
        }
      }
      return out;
    }

    it('every route that is not @Public() answers 401 without a token', async () => {
      const all = routes();
      const guarded = all.filter((r) => !r.isPublic);
      expect(all.length).toBeGreaterThan(30);
      expect(guarded.map((r) => `${r.method} ${r.path.replace(/[0-9a-f-]{36}/, ':id')}`)).toEqual(
        expect.arrayContaining([
          'GET /me',
          'PATCH /me',
          'POST /auth/logout-all',
          'GET /auth/sessions',
          'DELETE /auth/sessions/:id',
          'POST /auth/2fa/setup',
          'POST /auth/2fa/enable',
          'POST /auth/2fa/disable',
          'GET /seller/me',
          'POST /seller/application',
          'GET /seller/products',
          'GET /admin/overview',
        ]),
      );
      for (const route of guarded) {
        const method = route.method.toLowerCase() as 'get' | 'post' | 'patch' | 'delete' | 'put';
        for (const token of [undefined, 'garbage.token.value']) {
          const req = api.raw()[method](`/v1${route.path}`);
          if (token) req.set('Authorization', `Bearer ${token}`);
          const res = await req.send({});
          expect(res.status, `${route.method} ${route.path}`).toBe(401);
          expect(ErrorBody.parse(res.body).error.code).toBe('UNAUTHENTICATED');
        }
      }
    });

    it('only the storefront reads and the login endpoints are public', () => {
      const publicRoutes = routes()
        .filter((r) => r.isPublic)
        .map((r) => `${r.method} ${r.path.replace(/[0-9a-f-]{36}/, ':id')}`)
        .sort();
      expect(publicRoutes).toEqual(
        [
          'GET /health',
          'GET /categories',
          'GET /categories/:id',
          'GET /brands',
          'GET /brands/:id',
          'GET /products',
          'GET /products/:id',
          'GET /products/:id/reviews',
          'GET /reviews',
          'GET /stores',
          'GET /stores/:id',
          'GET /ads/packages',
          'GET /ads/serve',
          'GET /cms/hero-scenes',
          'GET /plans',
          'POST /auth/register',
          'POST /auth/otp/send',
          'POST /auth/otp/verify',
          'POST /auth/login',
          'POST /auth/2fa/challenge',
          'POST /auth/refresh',
          'POST /auth/logout',
          'POST /auth/password/forgot',
          'POST /auth/password/reset',
        ].sort(),
      );
    });
  });

  describe('seller scoping', () => {
    const sellerProducts = z.object({
      items: z.array(SellerProductRow),
      nextCursor: z.string().nullable(),
    });

    async function sellerWithProducts(count: number) {
      const login = await registerAndVerify(api, outbox, {
        audience: 'seller',
        email: uniqueEmail('shop'),
      });
      const sellerId = login.user.seller?.sellerId ?? '';
      const ref = await db.product.findFirstOrThrow({
        select: { brandId: true, categoryId: true },
      });
      const ids = Array.from({ length: count }, () => uuidv7());
      await db.product.createMany({
        data: ids.map((id, i) => ({
          id,
          sellerId,
          ...ref,
          title: `Scoped product ${i}`,
          slug: `scoped-${id}`,
          status: i === 0 ? ('draft' as const) : ('pending_review' as const),
        })),
      });
      return { login, sellerId, ids };
    }

    it('/seller/products returns only the caller’s own rows (IDOR)', async () => {
      const mine = await sellerWithProducts(3);
      const theirs = await sellerWithProducts(2);
      const res = await api.get('/seller/products', mine.login.tokens.accessToken).expect(200);
      const page = sellerProducts.parse(res.body);
      expect(page.items.map((p) => p.id).sort()).toEqual([...mine.ids].sort());
      expect(page.nextCursor).toBeNull();
      // Pagination with an opaque cursor.
      const first = sellerProducts.parse(
        (await api.get('/seller/products?limit=2', mine.login.tokens.accessToken).expect(200)).body,
      );
      expect(first.items).toHaveLength(2);
      const rest = sellerProducts.parse(
        (
          await api
            .get(
              `/seller/products?limit=2&cursor=${first.nextCursor}`,
              mine.login.tokens.accessToken,
            )
            .expect(200)
        ).body,
      );
      expect([...first.items, ...rest.items].map((p) => p.id).sort()).toEqual([...mine.ids].sort());
      // The seller id can never come from the request.
      const smuggled = await api
        .get(`/seller/products?sellerId=${theirs.sellerId}`, mine.login.tokens.accessToken)
        .expect(400);
      expect(ErrorBody.parse(smuggled.body).error.code).toBe('VALIDATION_FAILED');
      // Seller routes need a seller app token with a seller context.
      await api.get('/seller/products', theirs.login.tokens.accessToken).expect(200);
      Page(SellerProductRow).parse(
        (await api.get('/seller/products', theirs.login.tokens.accessToken).expect(200)).body,
      );
    });

    it('RLS hides other sellers’ rows inside withSellerScope for a non-owner role', async () => {
      const mine = await sellerWithProducts(2);
      const prisma = app.get(PrismaService);
      const total = await db.product.count();
      const [{ canCreateRoles }] = await db.$queryRaw<[{ canCreateRoles: boolean }]>`
        SELECT (rolsuper OR rolcreaterole) AS "canCreateRoles" FROM pg_roles WHERE rolname = current_user`;
      // Table owners bypass RLS, so the query must run as a non-owner role (as the API does in
      // staging/prod with app_user). CI's database user may create one; a local user that may
      // not (plain owner) instead makes RLS apply to the owner for the duration of the test.
      const role = 'hb_rls_probe';
      const asNonOwner = canCreateRoles ? `SET LOCAL ROLE ${role}` : 'SELECT 1';
      if (canCreateRoles) {
        await db.$executeRawUnsafe(
          `DO $$ BEGIN CREATE ROLE ${role} NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
        );
        await db.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO ${role}`);
        await db.$executeRawUnsafe(`GRANT SELECT ON products TO ${role}`);
      } else {
        await db.$executeRawUnsafe('ALTER TABLE products FORCE ROW LEVEL SECURITY');
      }
      try {
        // No WHERE seller_id here on purpose: RLS alone must hide the other sellers' rows.
        const scoped = await prisma.withSellerScope(mine.sellerId, async (tx) => {
          await tx.$executeRawUnsafe(asNonOwner);
          return tx.product.findMany({ select: { id: true, sellerId: true } });
        });
        expect(scoped.map((p) => p.id).sort()).toEqual([...mine.ids].sort());
        expect(total).toBeGreaterThan(scoped.length);

        // Controls: platform staff see every row; without a scope nothing is visible.
        const staff = await prisma.withPlatformScope('admin', async (tx) => {
          await tx.$executeRawUnsafe(asNonOwner);
          return tx.product.count();
        });
        expect(staff).toBe(total);
        const unscoped = await prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(asNonOwner);
          return tx.product.count();
        });
        expect(unscoped).toBe(0);
      } finally {
        if (canCreateRoles) {
          await db.$executeRawUnsafe(`REVOKE ALL ON products FROM ${role}`);
          await db.$executeRawUnsafe(`REVOKE USAGE ON SCHEMA public FROM ${role}`);
        } else {
          await db.$executeRawUnsafe('ALTER TABLE products NO FORCE ROW LEVEL SECURITY');
        }
      }
    });
  });

  describe('seller application', () => {
    it('turns a signed-in customer into a draft seller and re-issues tokens with the seller context', async () => {
      const email = uniqueEmail('apply');
      const customer = await registerAndVerify(api, outbox, { audience: 'web', email });
      // The web app token cannot use seller routes.
      const web = await api
        .post(
          '/seller/application',
          { type: 'vendor', storeName: 'Glow Lane' },
          {
            token: customer.tokens.accessToken,
          },
        )
        .expect(403);
      expect(ErrorBody.parse(web.body).error.code).toBe('FORBIDDEN');

      const seller = expectOk((await passwordLogin(api, email, 'seller').expect(200)).body);
      expect(claims(seller.tokens.accessToken).sel).toBeUndefined();
      await api.get('/seller/me', seller.tokens.accessToken).expect(403);
      await api.get('/seller/products', seller.tokens.accessToken).expect(403);
      const strict = await api
        .post(
          '/seller/application',
          { type: 'vendor', storeName: 'Glow Lane', status: 'approved' },
          {
            token: seller.tokens.accessToken,
          },
        )
        .expect(400);
      expect(ErrorBody.parse(strict.body).error.code).toBe('VALIDATION_FAILED');

      const res = await api
        .post(
          '/seller/application',
          { type: 'vendor', storeName: 'Glow Lane' },
          {
            token: seller.tokens.accessToken,
          },
        )
        .expect(201);
      const tokens = TokenPair.parse(res.body);
      const c = claims(tokens.accessToken);
      expect(c).toMatchObject({ aud: 'seller', role: 'seller', srole: 'owner' });
      expect(c.sel).toEqual(expect.any(String));
      const profile = SellerProfile.parse(
        (await api.get('/seller/me', tokens.accessToken).expect(200)).body,
      );
      expect(profile).toMatchObject({ id: c.sel, status: 'draft', type: 'vendor', role: 'owner' });
      expect(profile.storeName).toBe('Glow Lane');
      const me = Me.parse((await api.get('/me', tokens.accessToken).expect(200)).body);
      expect(me.role).toBe('seller');
      expect(me.seller?.sellerId).toBe(c.sel);

      const again = await api
        .post(
          '/seller/application',
          { type: 'manufacturer', storeName: 'Second Shop' },
          {
            token: tokens.accessToken,
          },
        )
        .expect(409);
      expect(ErrorBody.parse(again.body).error.code).toBe('CONFLICT');
      expect(
        await db.auditLog.count({
          where: { action: 'seller.application_started', actorId: customer.user.id },
        }),
      ).toBe(1);
    });
  });
});
