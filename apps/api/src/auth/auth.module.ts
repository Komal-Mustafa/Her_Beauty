import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { CaptchaService } from './captcha.service';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';
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
  controllers: [AuthController, ContactController],
  providers: [
    AuthGuard,
    AuthService,
    CaptchaService,
    ContactService,
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
