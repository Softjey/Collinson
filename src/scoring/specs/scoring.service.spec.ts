import { Test } from '@nestjs/testing';
import { ACTIVITIES } from '../entities/activity.js';
import { withWeatherAndSea } from '../../../test/support/builders/day.js';
import { ALL_ACTIVITY_SCORERS } from '../entities/activities.js';
import { ActivityCatalogue } from '../entities/activity-scorers.js';
import { ScoreScale } from '../entities/score-scale.js';
import { DailyFeaturesMapper } from '../mappers/daily-features.mapper.js';
import { FeatureValuesMapper } from '../mappers/feature-values.mapper.js';
import { ScoringModule } from '../scoring.module.js';
import { ScoringService } from '../scoring.service.js';

const hourlyWeather = {
  unixSeconds: 0,
  temperatureC: 7,
  relativeHumidityPercent: 50,
  precipitationMm: 0,
  rainMm: 0,
  snowfallCm: 0,
  snowDepthM: 0,
  cloudCoverPercent: 20,
  windSpeedKmh: 10,
};

const day = withWeatherAndSea({ maxWindSpeedKmh: 15 });

describe('ScoringService', () => {
  const service = new ScoringService(
    new ActivityCatalogue(ALL_ACTIVITY_SCORERS),
    new ScoreScale(),
    new DailyFeaturesMapper(),
    new FeatureValuesMapper(),
  );

  it('scores the requested activities in order', () => {
    const results = service.score(['INDOOR_SIGHTSEEING', 'SKIING', 'SURFING'], day);

    expect(results.map(({ activity }) => activity)).toEqual(['INDOOR_SIGHTSEEING', 'SKIING', 'SURFING']);
    expect(results[0].outcome.kind).toBe('scored');
    expect(results[1].outcome).toEqual({ kind: 'unscored', reason: 'NO_SNOW' });
    expect(results[2].outcome).toEqual({ kind: 'scored', score: 1 });
  });

  it('scores every known activity', () => {
    expect(service.score(ACTIVITIES, day)).toHaveLength(ACTIVITIES.length);
  });

  it('returns nothing for no activities', () => {
    expect(service.score([], day)).toEqual([]);
  });

  it('fails for an unknown activity', () => {
    expect(() => service.score(['CURLING' as never], day)).toThrow('CURLING');
  });

  it('summarises hourly weather into days of the given time zone', () => {
    const hours = [{ ...hourlyWeather, unixSeconds: Date.parse('2024-01-10T00:00:00Z') / 1000 }];

    expect(service.summariseWeatherDays(hours, 'UTC').get('2024-01-10')?.maxTemperatureC).toBe(7);
  });

  it('summarises hourly waves into days of the given time zone', () => {
    const hours = [
      { unixSeconds: Date.parse('2024-01-10T00:00:00Z') / 1000, waveHeightM: 2, wavePeriodS: 9 },
    ];

    expect(service.summariseMarineDays(hours, 'UTC').get('2024-01-10')).toEqual({
      maxWaveHeightM: 2,
      maxWavePeriodS: 9,
    });
  });

  it('rates a score into its category', () => {
    expect(service.rate(0.395)).toEqual({ score: 0.4, categoryIndex: 3, category: 'MARGINAL' });
  });

  it('reports the sources the activities need', () => {
    expect([...service.requiredSources(['SURFING', 'SKIING'])].sort()).toEqual(['WAVES', 'WEATHER']);
    expect(service.requiredSources(['SKIING'])).toEqual(['WEATHER']);
    expect(service.requiredSources([])).toEqual([]);
  });

  it('fails to report the sources of an unknown activity', () => {
    expect(() => service.requiredSources(['CURLING' as never])).toThrow('CURLING');
  });
});

describe('ScoringModule', () => {
  it('provides and exports the scoring service', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ScoringModule] }).compile();

    expect(moduleRef.get(ScoringService)).toBeInstanceOf(ScoringService);
  });
});
