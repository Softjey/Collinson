import { ALL_ACTIVITY_SCORERS, INDOOR_SIGHTSEEING, SKIING, SURFING } from '../activities.js';
import { ACTIVITIES } from '../activity.js';
import { ActivityCatalogue, FormulaScorer, OppositeScorer, type FormulaSpec } from '../activity-scorers.js';
import { Curve } from '../curves.js';
import { Combiner, Condition, DerivedFeature } from '../formula-parts.js';

const warmthUtility = Curve.piecewiseLinear([0, 0], [10, 1]);

const warmthSpec: FormulaSpec = {
  activity: 'SKIING',
  requiredSources: ['WEATHER'],
  unscoredWhen: [{ reason: 'NO_DATA', when: Condition.anyMissing('maxTemperatureC', 'totalRainMm') }],
  factors: [{ feature: 'maxTemperatureC', utility: warmthUtility, weight: 1 }],
  combiner: Combiner.weightedSum(),
};

const warmth = new FormulaScorer(warmthSpec);
const scoreOf = (score: number) => ({ kind: 'scored', score });

describe('FormulaScorer unscored rules', () => {
  it('scores when no rule matches', () => {
    expect(warmth.score({ maxTemperatureC: 5, totalRainMm: 0 })).toEqual(scoreOf(0.5));
  });

  it('returns the reason of the first matching rule', () => {
    const scorer = new FormulaScorer({
      ...warmthSpec,
      unscoredWhen: [
        { reason: 'NO_SEA', when: Condition.equals('hasSea', 0) },
        { reason: 'NO_DATA', when: Condition.anyMissing('maxTemperatureC') },
      ],
    });

    expect(scorer.score({ hasSea: 0 })).toEqual({ kind: 'unscored', reason: 'NO_SEA' });
    expect(scorer.score({})).toEqual({ kind: 'unscored', reason: 'NO_DATA' });
  });

  it('treats a missing feature and a null feature alike', () => {
    expect(warmth.score({ maxTemperatureC: 5 })).toEqual({ kind: 'unscored', reason: 'NO_DATA' });
    expect(warmth.score({ maxTemperatureC: null, totalRainMm: 0 })).toEqual({
      kind: 'unscored',
      reason: 'NO_DATA',
    });
  });

  it('fails when a factor reads a feature that no rule guards against missing', () => {
    const careless = new FormulaScorer({ ...warmthSpec, unscoredWhen: [] });

    expect(() => careless.score({ totalRainMm: 0 })).toThrow('maxTemperatureC');
  });
});

describe('FormulaScorer score', () => {
  it('applies multipliers to the combined score', () => {
    const scorer = new FormulaScorer({
      ...warmthSpec,
      multipliers: [{ feature: 'totalRainMm', utility: Curve.piecewiseLinear([0, 1], [4, 0]) }],
    });

    expect(scorer.score({ maxTemperatureC: 10, totalRainMm: 1 })).toEqual(scoreOf(0.75));
  });

  it('applies a cap only when its condition holds and never raises a score', () => {
    const scorer = new FormulaScorer({
      ...warmthSpec,
      caps: [{ when: Condition.atLeast('totalRainMm', 6), max: 0.3 }],
    });

    expect(scorer.score({ maxTemperatureC: 10, totalRainMm: 5.99 })).toEqual(scoreOf(1));
    expect(scorer.score({ maxTemperatureC: 10, totalRainMm: 6 })).toEqual(scoreOf(0.3));
    expect(scorer.score({ maxTemperatureC: 2, totalRainMm: 6 })).toEqual(scoreOf(0.2));
  });

  it('reads derived features as if they were raw', () => {
    const scorer = new FormulaScorer({
      ...warmthSpec,
      derivedFeatures: { meanWindSpeedMs: DerivedFeature.quotient({ of: 'maxTemperatureC', dividedBy: 2 }) },
      factors: [{ feature: 'meanWindSpeedMs', utility: warmthUtility, weight: 1 }],
    });

    expect(scorer.score({ maxTemperatureC: 10, totalRainMm: 0 })).toEqual(scoreOf(0.5));
  });
});

describe('OppositeScorer', () => {
  const indoor = new OppositeScorer('INDOOR_SIGHTSEEING', warmth, { floor: 0.5, spread: 0.5 });

  it('scores floor + spread * (1 - the opposed score)', () => {
    expect(indoor.score({ maxTemperatureC: 10, totalRainMm: 0 })).toEqual(scoreOf(0.5));
    expect(indoor.score({ maxTemperatureC: 0, totalRainMm: 0 })).toEqual(scoreOf(1));
  });

  it('passes the unscored reason of the opposed scorer through', () => {
    expect(indoor.score({ maxTemperatureC: null, totalRainMm: 0 })).toEqual({
      kind: 'unscored',
      reason: 'NO_DATA',
    });
  });

  it('needs the sources of the opposed scorer', () => {
    expect(indoor.requiredSources).toEqual(['WEATHER']);
  });
});

describe('ActivityCatalogue', () => {
  const catalogue = new ActivityCatalogue(ALL_ACTIVITY_SCORERS);

  it('has a scorer for every activity', () => {
    for (const activity of ACTIVITIES) {
      expect(catalogue.scorerFor(activity).activity).toBe(activity);
    }
  });

  it('fails for an unknown activity', () => {
    expect(() => catalogue.scorerFor('CURLING' as never)).toThrow('CURLING');
  });

  it('fails for an activity it was not given a scorer for', () => {
    expect(() => new ActivityCatalogue([SKIING]).scorerFor('SURFING')).toThrow('SURFING');
  });

  it('rejects two scorers for the same activity', () => {
    expect(() => new ActivityCatalogue([SKIING, SKIING]).scorerFor('SKIING')).toThrow('SKIING');
  });

  describe('requiredSourcesOf', () => {
    it('requires weather and waves for surfing and skiing', () => {
      expect([...catalogue.requiredSourcesOf(['SURFING', 'SKIING'])].sort()).toEqual(['WAVES', 'WEATHER']);
    });

    it('requires weather only for skiing and for both sightseeing activities', () => {
      expect(catalogue.requiredSourcesOf(['SKIING'])).toEqual(['WEATHER']);
      expect(catalogue.requiredSourcesOf(['OUTDOOR_SIGHTSEEING', 'INDOOR_SIGHTSEEING'])).toEqual(['WEATHER']);
    });

    it('takes the sources of the scorer an opposite scorer is based on', () => {
      expect(new ActivityCatalogue([INDOOR_SIGHTSEEING]).requiredSourcesOf(['INDOOR_SIGHTSEEING'])).toEqual([
        'WEATHER',
      ]);
    });

    it('requires nothing for no activities', () => {
      expect(catalogue.requiredSourcesOf([])).toEqual([]);
    });

    it('fails when a requested activity is unknown', () => {
      expect(() => catalogue.requiredSourcesOf(['CURLING' as never])).toThrow('CURLING');
    });

    it('lists the sources of surfing without duplicates', () => {
      expect(catalogue.requiredSourcesOf(['SURFING', 'SURFING'])).toEqual(SURFING.requiredSources);
    });
  });
});
