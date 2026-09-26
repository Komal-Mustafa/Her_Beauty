import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { CaptchaService } from './captcha.service';
import { LockoutService } from './lockout.service';
import { MfaService } from './mfa.service';
import { OtpService } from './otp.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';
import { SignInService } from './sign-in.service';
import { TokenService } from './token.service';
import { TwoFactorService } from './two-factor.service';

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [
    AuthGuard,
    AuthService,
    CaptchaService,
    LockoutService,
    MfaService,
    OtpService,
    PasswordService,
    SessionService,
    SignInService,
    TokenService,
    TwoFactorService,
  ],
  exports: [AuthGuard, PasswordService, SessionService, SignInService, TokenService, UsersModule],
})
export class AuthModule {}
