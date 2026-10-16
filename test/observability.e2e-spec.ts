import request from 'supertest';
import { TelemetrySdk } from '../src/shared/observability/telemetry-sdk.js';
import { createTestApp, graphqlRequest, type TestApp } from './support/app.js';
import { useTestDatabase } from './support/database.js';
import { loadFixture } from './support/fixtures.js';
import { SEARCH_LOCATIONS } from './support/queries.js';

const UNREACHABLE_COLLECTOR = 'http://127.0.0.1:1';

describe('with OpenTelemetry enabled and no collector reachable', () => {
  useTestDatabase();
  let testApp: TestApp;
  let sdk: ReturnType<typeof TelemetrySdk.start>;

  beforeAll(async () => {
    sdk = TelemetrySdk.start({ enabled: true, endpoint: UNREACHABLE_COLLECTOR });
    testApp = await createTestApp({ otelEnabled: true });
  });

  afterAll(async () => {
    await testApp.app.close();
    await sdk?.shutdown().catch(() => undefined);
  });

  it('still answers health checks', async () => {
    const response = await request(testApp.app.getHttpServer()).get('/health');

    expect(response.status).toBe(200);
  });

  it('still answers GraphQL queries', async () => {
    testApp.openMeteo.respond('geocoding', loadFixture('search/geocoding-zakopane.json'));

    const response = await graphqlRequest(testApp, SEARCH_LOCATIONS, { name: 'Zakopane', count: 2 });

    expect(response.status).toBe(200);
    expect(response.body.errors).toBeUndefined();
    expect(response.body.data.searchLocations).toHaveLength(2);
  });
});
