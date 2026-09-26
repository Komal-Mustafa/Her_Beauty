import { z } from 'zod';
import { Id, Money } from './common';

// PRD §7.5 selling plans [CONFIRM prices/limits].
export const SellingPlan = z.object({
  id: Id,
  code: z.enum(['standard', 'business', 'enterprise']),
  name: z.string(),
  priceMonthly: Money,
  productLimit: z.number().int().positive().nullable(), // null = unlimited
  imagesPerProduct: z.number().int().positive(),
  video: z.boolean(),
  model3d: z.boolean(),
  staffLogins: z.number().int().positive(),
  commissionBps: z.number().int().min(0).max(10_000), // basis points: 1500 = 15%
  adDiscountBps: z.number().int().min(0).max(10_000),
});
export type SellingPlan = z.infer<typeof SellingPlan>;
