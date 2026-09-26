import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Post, Query } from '@nestjs/common';
import { StartSellerApplicationRequest } from '@hb/types';
import { z } from 'zod';
import type { AuthContext } from '../auth/auth-context';
import { forbidden } from '../auth/auth-errors';
import { Audiences, CurrentAuth, SellerRoles } from '../auth/decorators';
import { Client, type ClientContext } from '../common/client';
import { coerceQuery, parse } from '../common/validate';
import { SELLER_PRODUCTS_MAX_LIMIT, SellerService } from './seller.service';

const ProductsQuery = z
  .object({
    cursor: z.string().max(200).optional(),
    limit: z.number().int().min(1).max(SELLER_PRODUCTS_MAX_LIMIT).optional(),
  })
  .strict();

/** Seller portal (seller app tokens only). The seller id is always the token's. */
@Controller('seller')
@Audiences('seller')
export class SellerController {
  constructor(@Inject(SellerService) private readonly sellers: SellerService) {}

  @Get('me')
  @SellerRoles()
  me(@CurrentAuth() auth: AuthContext) {
    return this.sellers.profile(auth);
  }

  /** For signed-in users without a seller yet; returns new tokens that carry the seller context. */
  @Post('application')
  @HttpCode(HttpStatus.CREATED)
  start(@CurrentAuth() auth: AuthContext, @Body() body: unknown, @Client() client: ClientContext) {
    return this.sellers.startApplication(
      auth,
      parse(StartSellerApplicationRequest.strict(), body),
      client,
    );
  }

  @Get('products')
  @SellerRoles()
  products(@CurrentAuth() auth: AuthContext, @Query() raw: Record<string, unknown>) {
    const query = parse(ProductsQuery, coerceQuery(raw, { numbers: ['limit'] }));
    if (!auth.sellerId) throw forbidden('This needs a seller account.');
    return this.sellers.products(auth.sellerId, query);
  }
}
