// NestJS
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';

// Modules
import { AppModule } from './app.module';
import { RedisIoAdapter } from './family/redis-io.adapter';

function getCorsOrigins(): string[] {
  const fromEnv = process.env.FRONTEND_ORIGINS;
  if (fromEnv) {
    return fromEnv.split(',').map((origin) => origin.trim());
  }
  return ['http://localhost:7782'];
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.enableCors({ origin: true, credentials: true });

  const port = parseInt(process.env.PORT || '7781', 10);
  await app.listen(port);
}
void bootstrap();
