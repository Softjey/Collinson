import request from 'supertest';
import { createTestApp, type TestApp } from './support/app.js';

describe('GET /health', () => {
  it('returns 200 when Postgres is reachable and never calls Open-Meteo', async () => {
    const testApp = await createTestApp();

    const response = await request(testApp.app.getHttpServer()).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
    expect(testApp.openMeteo.calls).toHaveLength(0);
    await testApp.app.close();
  });

  it('returns 503 when Postgres is down and still never calls Open-Meteo', async () => {
    let testApp: TestApp | undefined;
    try {
      testApp = await createTestApp({ databaseUrl: 'postgresql://postgres:postgres@127.0.0.1:1/none' });

      const response = await request(testApp.app.getHttpServer()).get('/health');

      expect(response.status).toBe(503);
      expect(response.body).toEqual({ status: 'error' });
      expect(testApp.openMeteo.calls).toHaveLength(0);
    } finally {
      await testApp?.app.close();
    }
  });
});
