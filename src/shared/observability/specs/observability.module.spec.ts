import { Test } from '@nestjs/testing';
import { APP_CONFIG, ConfigModule } from '../../config/config.module.js';
import { parseEnv } from '../../config/env.schema.js';
import { Metrics } from '../metrics.js';
import { NoopMetrics } from '../noop-metrics.js';
import { ObservabilityModule } from '../observability.module.js';
import { OpenTelemetryMetrics } from '../open-telemetry-metrics.js';

async function metricsFor(otelEnabled: 'true' | 'false'): Promise<Metrics> {
  const moduleRef = await Test.createTestingModule({ imports: [ConfigModule, ObservabilityModule] })
    .overrideProvider(APP_CONFIG)
    .useValue(parseEnv({ DATABASE_URL: 'postgresql://unused', OTEL_ENABLED: otelEnabled }))
    .compile();
  return moduleRef.get(Metrics);
}

describe('ObservabilityModule', () => {
  it('provides no-op metrics when OTEL_ENABLED is false', async () => {
    expect(await metricsFor('false')).toBeInstanceOf(NoopMetrics);
  });

  it('provides OpenTelemetry metrics when OTEL_ENABLED is true', async () => {
    expect(await metricsFor('true')).toBeInstanceOf(OpenTelemetryMetrics);
  });
});
