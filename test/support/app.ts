import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { APP_CONFIG } from '../../src/shared/config/config.module.js';
import { parseEnv } from '../../src/shared/config/env.schema.js';
import { Metrics } from '../../src/shared/observability/metrics.js';
import { OpenMeteoService } from '../../src/shared/open-meteo/open-meteo.service.js';
import { testDatabaseUrl } from './database.js';
import { FakeOpenMeteo } from './fake-open-meteo.js';
import { InMemoryMetrics } from './in-memory-metrics.js';

export interface TestApp {
  app: INestApplication;
  openMeteo: FakeOpenMeteo;
  inMemoryMetrics: InMemoryMetrics;
}

export async function createTestApp(
  options: { databaseUrl?: string; otelEnabled?: boolean } = {},
): Promise<TestApp> {
  const openMeteo = new FakeOpenMeteo();
  const inMemoryMetrics = new InMemoryMetrics();
  const config = parseEnv({
    ...process.env,
    DATABASE_URL: options.databaseUrl ?? testDatabaseUrl(),
    OTEL_ENABLED: String(options.otelEnabled ?? false),
    LOG_LEVEL: 'silent',
  });

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(APP_CONFIG)
    .useValue(config)
    .overrideProvider(OpenMeteoService)
    .useValue(openMeteo)
    .overrideProvider(Metrics)
    .useValue(inMemoryMetrics.metrics)
    .compile();

  const app = moduleRef.createNestApplication();
  await app.init();
  return { app, openMeteo, inMemoryMetrics };
}

/** Registers the Jest hooks of an e2e suite: one app for the whole suite, the scripted Open-Meteo reset per test. */
export function useTestApp(): TestApp {
  const testApp = {} as TestApp;

  beforeAll(async () => {
    Object.assign(testApp, await createTestApp());
  });

  beforeEach(() => {
    testApp.openMeteo.reset();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  return testApp;
}

export function graphqlRequest(testApp: TestApp, query: string, variables: Record<string, unknown> = {}) {
  return request(testApp.app.getHttpServer()).post('/graphql').send({ query, variables });
}
