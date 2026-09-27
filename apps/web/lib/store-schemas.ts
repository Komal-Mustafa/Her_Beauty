import * as z from 'zod/mini';

/*
 * Field rules for the client stores: the same as `Id`, `Slug` and `Money` in @hb/types. Those are
 * classic zod; the header (every shop page) reads the cart, and zod/mini keeps about 20 KB gz of
 * validator out of that bundle. Keep the rules in step with @hb/types.
 */

export const StoredId = z.string().check(z.minLength(1), z.maxLength(100));
export const StoredSlug = z.string().check(z.maxLength(200), z.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/));
/** Integer paisa (rules.md §1.2). */
export const StoredMoney = z.int().check(z.nonnegative());
