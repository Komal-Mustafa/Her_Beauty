import { HttpStatus } from '@nestjs/common';
import type { z } from 'zod';
import { ApiError } from './errors';

/** Parses untrusted input with a shared zod schema (rules.md: validate at the edge). */
export function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ApiError(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Some fields are invalid.', {
      issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  return result.data;
}

/** Query strings arrive as strings; turn "a,b" into arrays and numeric strings into numbers. */
export function coerceQuery(
  raw: Record<string, unknown>,
  opts: { arrays?: string[]; numbers?: string[] },
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...raw };
  for (const key of opts.arrays ?? []) {
    const v = out[key];
    if (typeof v === 'string') out[key] = v.split(',').filter(Boolean);
  }
  for (const key of opts.numbers ?? []) {
    const v = out[key];
    if (typeof v === 'string' && v.trim() !== '') out[key] = Number(v);
  }
  return out;
}
