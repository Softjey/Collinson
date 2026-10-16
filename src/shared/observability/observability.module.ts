import { Global, Module } from '@nestjs/common';
import { metrics } from '@opentelemetry/api';
import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/env.schema.js';
import { Metrics } from './metrics.js';
import { NoopMetrics } from './noop-metrics.js';
import { OpenTelemetryMetrics } from './open-telemetry-metrics.js';

export const METER_NAME = 'weather-activity-ranker';

@Global()
@Module({
  providers: [
    {
      provide: Metrics,
      inject: [APP_CONFIG],
      useFactory: ({ otel }: AppConfig): Metrics =>
        otel.enabled ? new OpenTelemetryMetrics(metrics.getMeter(METER_NAME)) : new NoopMetrics(),
    },
  ],
  exports: [Metrics],
})
export class ObservabilityModule {}
