import { ConfigService } from '@nestjs/config';

const DEVELOPMENT_JWT_SECRET = 'khandan-najaf-dev-secret-change-in-production';

export function resolveJwtSecret(config: ConfigService): string {
  const configured = config.get<string>('JWT_SECRET')?.trim();
  const isProduction = config.get<string>('NODE_ENV') === 'production';

  const isUnsafe =
    !configured ||
    configured.length < 32 ||
    /change-me|dev-secret/i.test(configured) ||
    configured === DEVELOPMENT_JWT_SECRET;

  if (isProduction && isUnsafe) {
    throw new Error(
      'JWT_SECRET must be set to a strong, unique value in production',
    );
  }

  return configured || DEVELOPMENT_JWT_SECRET;
}
