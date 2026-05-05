import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const corsOrigin = config.get<string>('CORS_ORIGIN') ?? 'http://localhost:4200';
  app.enableCors({
    origin: corsOrigin.split(',').map((origin: string) => origin.trim()).filter(Boolean),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  });
  const port = Number(config.get('APP_PORT') ?? 3000);
  await app.listen(port);
  console.log(`Server running on http://localhost:${port}`);
}
bootstrap();
