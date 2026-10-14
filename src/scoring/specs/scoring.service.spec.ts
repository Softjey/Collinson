import { Test } from '@nestjs/testing';
import { ACTIVITIES } from '../entities/activity.js';
import type { DayContext } from '../entities/definition.types.js';
import { ScoringModule } from '../scoring.module.js';
import { ScoringService } from '../scoring.service.js';

const day: DayContext = {
  weather: {
    tMax: 22,
    rhMean: 50,
    precip: 0,
    rain: 0,
    snowfallSum: 0,
    snowDepthMax: 0,
    snowHours: 0,
    cloud: 20,
    windMean: 15,
    windMax: 15,
  },
  marine: { hasSea: true, features: { waveHeight: 1.5, wavePeriod: 13 } },
};

describe('ScoringService', () => {
  const service = new ScoringService();

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
