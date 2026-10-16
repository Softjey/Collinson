import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { logs, metrics, NodeSDK } from '@opentelemetry/sdk-node';
import type { AppConfig } from '../config/env.schema.js';

export const SERVICE_NAME = 'weather-activity-ranker';
const METRIC_EXPORT_INTERVAL_MS = 10_000;

export class TelemetrySdk {
  /** Returns null, and starts nothing, when OpenTelemetry is switched off. */
  static start({ enabled, endpoint }: AppConfig['otel']): NodeSDK | null {
    if (!enabled) {
      return null;
    }

    const sdk = new NodeSDK({
      serviceName: SERVICE_NAME,
      traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
      metricReaders: [
        new metrics.PeriodicExportingMetricReader({
          exporter: new OTLPMetricExporter({ url: `${endpoint}/v1/metrics` }),
          exportIntervalMillis: METRIC_EXPORT_INTERVAL_MS,
        }),
      ],
      logRecordProcessors: [
        new logs.BatchLogRecordProcessor({ exporter: new OTLPLogExporter({ url: `${endpoint}/v1/logs` }) }),
      ],
      instrumentations: [new HttpInstrumentation(), new ExpressInstrumentation(), new PinoInstrumentation()],
    });
    sdk.start();
    process.once('SIGTERM', () => void sdk.shutdown());
    return sdk;
  }
}
