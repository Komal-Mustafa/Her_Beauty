// Client-side field checks for blur-first validation (rules.md §7: zod on the client for UX; the
// server stays the source of truth). A check returns the message to show, or undefined when fine.

export type FieldCheck = (value: string, form: HTMLFormElement | null) => string | undefined;

/** Field name → message. */
export type FieldErrorMap = Record<string, string>;

type SafeParser = { safeParse(value: unknown): { success: boolean } };

/** `message` unless `schema` (any zod schema) accepts the value. */
export const fieldRule =
  (schema: SafeParser, message: string): FieldCheck =>
  (value) =>
    schema.safeParse(value).success ? undefined : message;

/** An empty value passes; anything typed must pass `check`. */
export const optionalField =
  (check: FieldCheck): FieldCheck =>
  (value, form) =>
    value.trim() === '' ? undefined : check(value, form);
