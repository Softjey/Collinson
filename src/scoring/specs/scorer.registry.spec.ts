import { IndoorSightseeingScorer } from '.././activities/indoor.scorer.js';
import { OutdoorSightseeingScorer } from '.././activities/outdoor.scorer.js';
import { SkiingScorer } from '.././activities/skiing.scorer.js';
import { SurfingScorer } from '.././activities/surfing.scorer.js';
import type { ActivityScorer } from '.././activity-scorer.js';
import { ScorerRegistry } from '.././scorer.registry.js';

const allScorers: ActivityScorer[] = [
  new SkiingScorer(),
  new SurfingScorer(),
  new OutdoorSightseeingScorer(),
  new IndoorSightseeingScorer(),
];

describe('ScorerRegistry', () => {
  const registry = new ScorerRegistry(allScorers);

  it('finds the scorer of every activity', () => {
    expect(registry.get('SKIING')).toBeInstanceOf(SkiingScorer);
    expect(registry.get('SURFING')).toBeInstanceOf(SurfingScorer);
    expect(registry.get('OUTDOOR_SIGHTSEEING')).toBeInstanceOf(OutdoorSightseeingScorer);
    expect(registry.get('INDOOR_SIGHTSEEING')).toBeInstanceOf(IndoorSightseeingScorer);
  });

  it('fails for an unknown activity', () => {
    expect(() => registry.get('CURLING' as never)).toThrow('CURLING');
  });

  it('fails for an activity without a registered scorer', () => {
    const partial = new ScorerRegistry([new SkiingScorer()]);

    expect(() => partial.get('SURFING')).toThrow('SURFING');
  });

  it('rejects two scorers for the same activity', () => {
    expect(() => new ScorerRegistry([new SkiingScorer(), new SkiingScorer()])).toThrow('SKIING');
  });

  it('requires weather and waves for surfing and skiing', () => {
    expect([...registry.requiredSources(['SURFING', 'SKIING'])].sort()).toEqual(['WAVES', 'WEATHER']);
  });

  it('requires weather only for skiing', () => {
    expect(registry.requiredSources(['SKIING'])).toEqual(['WEATHER']);
  });

  it('requires weather only for both sightseeing activities', () => {
    expect(registry.requiredSources(['OUTDOOR_SIGHTSEEING', 'INDOOR_SIGHTSEEING'])).toEqual(['WEATHER']);
  });

  it('requires nothing for no activities', () => {
    expect(registry.requiredSources([])).toEqual([]);
  });

  it('fails when a requested activity is unknown', () => {
    expect(() => registry.requiredSources(['CURLING' as never])).toThrow('CURLING');
  });
});
