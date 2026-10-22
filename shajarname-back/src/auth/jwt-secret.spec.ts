import { ConfigService } from '@nestjs/config';
import { resolveJwtSecret } from './jwt-secret';

function config(values: Record<string, string | undefined>): ConfigService {
  return { get: (key: string) => values[key] } as ConfigService;
}

describe('resolveJwtSecret', () => {
  it('rejects missing and placeholder secrets in production', () => {
    expect(() =>
      resolveJwtSecret(config({ NODE_ENV: 'production' })),
    ).toThrow();
    expect(() =>
      resolveJwtSecret(
        config({
          NODE_ENV: 'production',
          JWT_SECRET: 'change-me-in-production',
        }),
      ),
    ).toThrow();
  });

  it('accepts a sufficiently strong production secret', () => {
    const secret = 'a-unique-production-secret-with-40-characters';
    expect(
      resolveJwtSecret(config({ NODE_ENV: 'production', JWT_SECRET: secret })),
    ).toBe(secret);
  });

  it('keeps a deterministic local-development fallback', () => {
    expect(resolveJwtSecret(config({ NODE_ENV: 'development' }))).toContain(
      'dev-secret',
    );
  });
});
