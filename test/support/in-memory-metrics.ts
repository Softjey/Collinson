import type { Attributes } from '@opentelemetry/api';
import { metrics } from '@opentelemetry/sdk-node';
import {
  COUNTERS,
  HISTOGRAMS,
  type CounterName,
  type HistogramName,
} from '../../src/shared/observability/metrics.js';
import { OpenTelemetryMetrics } from '../../src/shared/observability/open-telemetry-metrics.js';

class PullMetricReader extends metrics.MetricReader {
  protected onShutdown(): Promise<void> {
    return Promise.resolve();
  }

  protected onForceFlush(): Promise<void> {
    return Promise.resolve();
  }
}

type Labels = Record<string, string>;

export class InMemoryMetrics {
  private readonly reader = new PullMetricReader();
  readonly metrics = new OpenTelemetryMetrics(
    new metrics.MeterProvider({ readers: [this.reader] }).getMeter('test'),
  );

  async counterValue(counter: CounterName, labels: Labels = {}): Promise<number> {
    const points = await this.dataPoints(COUNTERS[counter].name);
    return points
      .filter((point) => matches(point.attributes, labels))
      .reduce((sum, point) => sum + Number(point.value), 0);
  }

  async histogramCount(histogram: HistogramName, labels: Labels = {}): Promise<number> {
    const points = await this.dataPoints(HISTOGRAMS[histogram].name);
    return points
      .filter((point) => matches(point.attributes, labels))
      .reduce((sum, point) => sum + (point.value as { count: number }).count, 0);
  }

  private async dataPoints(metricName: string) {
    const { resourceMetrics } = await this.reader.collect();
    const metric = resourceMetrics.scopeMetrics
      .flatMap((scopeMetrics) => scopeMetrics.metrics)
      .find((candidate) => candidate.descriptor.name === metricName);
    return metric?.dataPoints ?? [];
  }
}

function matches(attributes: Attributes, expected: Labels): boolean {
  return Object.entries(expected).every(([name, value]) => attributes[name] === value);
}
