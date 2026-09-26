import { z } from 'zod';

/** Money is always an integer in the smallest unit (paisa). rules.md §1.2 — never floats. */
export const Money = z.number().int().nonnegative();
export type Money = z.infer<typeof Money>;

export const Currency = z.enum(['PKR', 'USD']);
export type Currency = z.infer<typeof Currency>;

export const Id = z.string().min(1);
export const Slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const HexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
export const IsoDateTime = z.iso.datetime();

/** A media asset path/URL (mock: /public path; later: R2/Stream URL). */
export const Asset = z.object({
  url: z.string().min(1),
  alt: z.string(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});
export type Asset = z.infer<typeof Asset>;

export const Page = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), nextCursor: z.string().nullable() });

export type Paged<T> = { items: T[]; nextCursor: string | null };
