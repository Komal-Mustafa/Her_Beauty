import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module';
import { AdsController } from './ads/ads.controller';
import { AdsService } from './ads/ads.service';
import { AuditModule } from './audit/audit.module';
import { AuthGuard } from './auth/auth.guard';
import { AuthModule } from './auth/auth.module';
import { CatalogController } from './catalog/catalog.controller';
import { CatalogService } from './catalog/catalog.service';
import { ApiExceptionFilter } from './common/errors';
import { ApiThrottlerGuard } from './common/throttler.guard';
import { ConfigModule } from './config/config.module';
import { HealthController } from './health/health.controller';
import { MessagingModule } from './messaging/messaging.module';
import { PrismaModule } from './prisma/prisma.module';
import { SellerModule } from './seller/seller.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuditModule,
    MessagingModule,
    // security.md: rate limits. Default 300 req/min per IP; auth routes set tighter limits.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    AuthModule,
    SellerModule,
    AdminModule,
  ],
  controllers: [HealthController, CatalogController, AdsController],
  providers: [
    CatalogService,
    AdsService,
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    // Order matters: throttle first (also unauthenticated floods), then default-deny auth.
    { provide: APP_GUARD, useClass: ApiThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
