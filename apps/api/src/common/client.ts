import { isIP } from 'node:net';
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/** Who is calling, as far as the network tells us. Never trusted for authorization. */
export interface ClientContext {
  /** Client IP from Express `req.ip` (honours TRUST_PROXY), or null when it is not an IP. */
  ip: string | null;
  userAgent: string | null;
}

const MAX_USER_AGENT = 512;

export function clientIp(req: Pick<Request, 'ip'>): string | null {
  let ip = req.ip ?? '';
  // IPv4 clients on a dual-stack socket show up as ::ffff:a.b.c.d; store the plain IPv4 form.
  if (ip.startsWith('::ffff:') && isIP(ip.slice(7)) === 4) ip = ip.slice(7);
  return isIP(ip) ? ip : null;
}

export function clientContext(req: Request): ClientContext {
  const ua = req.get('user-agent');
  return { ip: clientIp(req), userAgent: ua ? ua.slice(0, MAX_USER_AGENT) : null };
}

/** `@Client() client: ClientContext` */
export const Client = createParamDecorator((_data: unknown, ctx: ExecutionContext) =>
  clientContext(ctx.switchToHttp().getRequest<Request>()),
);
