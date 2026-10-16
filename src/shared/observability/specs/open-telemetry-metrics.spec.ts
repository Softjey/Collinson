import { InMemoryMetrics } from '../../../../test/support/in-memory-metrics.js';
import { NoopMetrics } from '../noop-metrics.js';

describe('OpenTelemetryMetrics', () => {
  it('counts an increment under its labels', async () => {
    const inMemoryMetrics = new InMemoryMetrics();

    inMemoryMetrics.metrics.increment('snapshotReused', { source: 'forecast' });
    inMemoryMetrics.metrics.increment('snapshotReused', { source: 'forecast' });
    inMemoryMetrics.metrics.increment('snapshotReused', { source: 'marine' });

    expect(await inMemoryMetrics.counterValue('snapshotReused', { source: 'forecast' })).toBe(2);
    expect(await inMemoryMetrics.counterValue('snapshotReused', { source: 'marine' })).toBe(1);
  });

  it('does not count an increment of another counter', async () => {
    const inMemoryMetrics = new InMemoryMetrics();

    inMemoryMetrics.metrics.increment('snapshotRefreshed', { source: 'forecast' });

    expect(await inMemoryMetrics.counterValue('snapshotReused')).toBe(0);
  });

  it('records a histogram observation under its labels', async () => {
    const inMemoryMetrics = new InMemoryMetrics();

    inMemoryMetrics.metrics.observe('openMeteoRequestDurationMs', 120, { source: 'marine' });

    expect(await inMemoryMetrics.histogramCount('openMeteoRequestDurationMs', { source: 'marine' })).toBe(1);
    expect(await inMemoryMetrics.histogramCount('openMeteoRequestDurationMs', { source: 'forecast' })).toBe(
      0,
    );
  });
});

describe('NoopMetrics', () => {
  it('accepts every call and records nothing', () => {
    const metrics = new NoopMetrics();

    expect(() => {
      metrics.increment();
      metrics.observe();
    }).not.toThrow();
  });
});
