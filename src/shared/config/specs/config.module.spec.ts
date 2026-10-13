import { Test } from '@nestjs/testing';
import { APP_CONFIG, ConfigModule } from './config.module.js';
import type { AppConfig } from './env.schema.js';

describe('ConfigModule', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('provides the parsed configuration', async () => {
    process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/db';
    process.env.PORT = '4000';

    const moduleRef = await Test.createTestingModule({ imports: [ConfigModule] }).compile();

    expect(moduleRef.get<AppConfig>(APP_CONFIG).port).toBe(4000);
  });

  it('refuses to start with an invalid environment', async () => {
    delete process.env.DATABASE_URL;

    await expect(Test.createTestingModule({ imports: [ConfigModule] }).compile()).rejects.toThrow(
      /DATABASE_URL/,
    );
  });
});
