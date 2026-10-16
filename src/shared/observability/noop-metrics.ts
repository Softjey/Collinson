import { Metrics } from './metrics.js';

export class NoopMetrics extends Metrics {
  increment(): void {}

  observe(): void {}
}
