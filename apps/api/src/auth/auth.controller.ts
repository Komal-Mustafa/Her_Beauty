import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
} from '@nestjs/common';
import {
  ForgotPasswordRequest,
  LoginRequest,
  LogoutRequest,
  OtpSendRequest,
  OtpVerifyRequest,
  RefreshRequest,
  RegisterRequest,
  ResetPasswordRequest,
  TwoFactorChallengeRequest,
  TwoFactorDisableRequest,
  TwoFactorEnableRequest,
  TwoFactorSetupRequest,
} from '@hb/types';
import { z } from 'zod';
import { Client, type ClientContext } from '../common/client';
import { notFound } from '../common/errors';
import { parse } from '../common/validate';
import type { AuthContext } from './auth-context';
import { unauthenticated } from './auth-errors';
import { AuthService } from './auth.service';
import { CurrentAuth, MaybeAuth, OptionalAuth, PerMinute, Public } from './decorators';
import { MfaService } from './mfa.service';
import { SessionService } from './session.service';

// Request bodies are the shared @hb/types schemas made strict: unknown fields ⇒ 400.
const RegisterBody = z.discriminatedUnion('audience', [
  RegisterRequest.options[0].strict(),
  RegisterRequest.options[1].strict(),
]);

/** Does the (not yet validated) body carry a challenge token? */
const hasChallengeToken = (body: unknown) =>
  typeof body === 'object' && body !== null && 'challengeToken' in body;

/** Endpoints of docs/b2-auth.md §3 under /v1/auth. Rate limits are per client IP. */
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(MfaService) private readonly mfa: MfaService,
    @Inject(SessionService) private readonly sessions: SessionService,
  ) {}

  @Public()
  @PerMinute(5)
  @Post('register')
  @HttpCode(HttpStatus.ACCEPTED)
  register(@Body() body: unknown, @Client() client: ClientContext) {
    return this.auth.register(parse(RegisterBody, body), client);
  }

  @Public()
  @PerMinute(5)
  @Post('otp/send')
  @HttpCode(HttpStatus.ACCEPTED)
  sendOtp(@Body() body: unknown, @Client() client: ClientContext) {
    return this.auth.sendOtp(parse(OtpSendRequest.strict(), body), client);
  }

  @Public()
  @PerMinute(10)
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  verifyOtp(@Body() body: unknown, @Client() client: ClientContext) {
    return this.auth.verifyOtp(parse(OtpVerifyRequest.strict(), body), client);
  }

  @Public()
  @PerMinute(10)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() body: unknown, @Client() client: ClientContext) {
    return this.auth.login(parse(LoginRequest.strict(), body), client);
  }

  @Public()
  @PerMinute(10)
  @Post('2fa/challenge')
  @HttpCode(HttpStatus.OK)
  challenge(@Body() body: unknown, @Client() client: ClientContext) {
    return this.mfa.challenge(parse(TwoFactorChallengeRequest.strict(), body), client);
  }

  /** Bearer token, or the setup challenge token of an admin's first sign-in. */
  @OptionalAuth()
  @PerMinute(10)
  @Post('2fa/setup')
  @HttpCode(HttpStatus.OK)
  setup(@Body() body: unknown, @MaybeAuth() auth: AuthContext | undefined) {
    if (!auth && !hasChallengeToken(body)) throw unauthenticated();
    const { challengeToken } = parse(TwoFactorSetupRequest.strict(), body ?? {});
    return this.mfa.setup(challengeToken, auth);
  }

  @OptionalAuth()
  @PerMinute(10)
  @Post('2fa/enable')
  @HttpCode(HttpStatus.OK)
  enable(
    @Body() body: unknown,
    @MaybeAuth() auth: AuthContext | undefined,
    @Client() client: ClientContext,
  ) {
    if (!auth && !hasChallengeToken(body)) throw unauthenticated();
    return this.mfa.enable(parse(TwoFactorEnableRequest.strict(), body), auth, client);
  }

  @PerMinute(10)
  @Post('2fa/disable')
  @HttpCode(HttpStatus.NO_CONTENT)
  async disable(
    @Body() body: unknown,
    @CurrentAuth() auth: AuthContext,
    @Client() client: ClientContext,
  ) {
    await this.mfa.disable(parse(TwoFactorDisableRequest.strict(), body), auth, client);
  }

  @Public()
  @PerMinute(30)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() body: unknown, @Client() client: ClientContext) {
    return this.auth.refresh(parse(RefreshRequest.strict(), body).refreshToken, client);
  }

  @Public()
  @PerMinute(30)
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() body: unknown) {
    await this.auth.logout(parse(LogoutRequest.strict(), body).refreshToken);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutAll(@CurrentAuth() auth: AuthContext, @Client() client: ClientContext) {
    await this.auth.logoutAll(auth, client);
  }

  @Get('sessions')
  sessionsList(@CurrentAuth() auth: AuthContext) {
    return this.sessions.list(auth.userId, auth.sessionId);
  }

  /** Only the caller's own sessions: another user's session id is a 404. */
  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeSession(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    const sessionId = z.uuid().safeParse(id);
    if (!sessionId.success || !(await this.sessions.revokeOwn(auth.userId, sessionId.data))) {
      throw notFound('Session');
    }
  }

  @Public()
  @PerMinute(5)
  @Post('password/forgot')
  @HttpCode(HttpStatus.ACCEPTED)
  forgot(@Body() body: unknown, @Client() client: ClientContext) {
    return this.auth.forgotPassword(parse(ForgotPasswordRequest.strict(), body), client);
  }

  @Public()
  @PerMinute(5)
  @Post('password/reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  async reset(@Body() body: unknown, @Client() client: ClientContext) {
    await this.auth.resetPassword(parse(ResetPasswordRequest.strict(), body), client);
  }
}
