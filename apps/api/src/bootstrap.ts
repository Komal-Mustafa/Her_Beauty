import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { Express } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { APP_CONFIG, type AppConfig } from './config/config';

export const API_PREFIX = 'v1';

/** Shared by main.ts and the integration tests so both run the exact same app. */
export function configureApp(app: INestApplication): INestApplication {
  // Client IP (rate limits, sessions, audit) = req.ip; only these proxies may set X-Forwarded-For.
  const config = app.get<AppConfig>(APP_CONFIG);
  const server: Express = app.getHttpAdapter().getInstance();
  server.set('trust proxy', config.trustProxy);
  app.setGlobalPrefix(API_PREFIX);
  app.use(helmet());
  const origins = (
    process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://localhost:3001,http://localhost:3002'
  )
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins, credentials: true });
  app.enableShutdownHooks();
  return app;
}

export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  return configureApp(app);
}
