import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';
import { APP_CONFIG } from '../../src/shared/config/config.module.js';
import { parseEnv } from '../../src/shared/config/env.schema.js';
import { OpenMeteoService } from '../../src/shared/open-meteo/open-meteo.service.js';
import { testDatabaseUrl } from './database.js';
import { FakeOpenMeteo } from './fake-open-meteo.js';

export interface TestApp {
  app: INestApplication;
  openMeteo: FakeOpenMeteo;
}

export async function createTestApp(options: { databaseUrl?: string } = {}): Promise<TestApp> {
  const openMeteo = new FakeOpenMeteo();
  const config = parseEnv({
    ...process.env,
    DATABASE_URL: options.databaseUrl ?? testDatabaseUrl(),
    OTEL_ENABLED: 'false',
  });

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(APP_CONFIG)
    .useValue(config)
    .overrideProvider(OpenMeteoService)
    .useValue(openMeteo)
    .compile();

  const app = moduleRef.createNestApplication();
  await app.init();
  return { app, openMeteo };
}
