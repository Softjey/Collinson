import type { Counter, Histogram, Meter } from '@opentelemetry/api';
import {
  COUNTERS,
  HISTOGRAMS,
  Metrics,
  type CounterName,
  type HistogramName,
  type MetricLabels,
} from './metrics.js';

function entriesOf<Name extends string, Definition, Instrument>(
  definitions: Record<Name, Definition>,
  create: (definition: Definition) => Instrument,
): Record<Name, Instrument> {
  return Object.fromEntries(
    Object.entries<Definition>(definitions).map(([name, definition]) => [name, create(definition)]),
  ) as Record<Name, Instrument>;
}

export class OpenTelemetryMetrics extends Metrics {
  private readonly counters: Record<CounterName, Counter>;
  private readonly histograms: Record<HistogramName, Histogram>;

  constructor(meter: Meter) {
    super();
    this.counters = entriesOf(COUNTERS, ({ name, description }) =>
      meter.createCounter(name, { description }),
    );
    this.histograms = entriesOf(HISTOGRAMS, ({ name, ...options }) => meter.createHistogram(name, options));
  }

  increment(counter: CounterName, labels: MetricLabels = {}): void {
    this.counters[counter].add(1, labels);
  }

  observe(histogram: HistogramName, value: number, labels: MetricLabels = {}): void {
    this.histograms[histogram].record(value, labels);
  }
}
