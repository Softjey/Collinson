import { ScoreScale } from '../score-scale.js';

describe('ScoreScale.rate', () => {
  const scale = new ScoreScale();

  it.each([
    [0, 1, 'UNSUITABLE'],
    [0.09, 1, 'UNSUITABLE'],
    [0.1, 2, 'POOR'],
    [0.39, 2, 'POOR'],
    [0.4, 3, 'MARGINAL'],
    [0.49, 3, 'MARGINAL'],
    [0.5, 4, 'ACCEPTABLE'],
    [0.59, 4, 'ACCEPTABLE'],
    [0.6, 5, 'GOOD'],
    [0.69, 5, 'GOOD'],
    [0.7, 6, 'VERY_GOOD'],
    [0.79, 6, 'VERY_GOOD'],
    [0.8, 7, 'EXCELLENT'],
    [0.89, 7, 'EXCELLENT'],
    [0.9, 8, 'IDEAL'],
    [1, 8, 'IDEAL'],
  ])('maps %s to category %i %s', (score, categoryIndex, category) => {
    expect(scale.rate(score)).toEqual({ score, categoryIndex, category });
  });

  it('rounds to 2 decimals before classifying', () => {
    expect(scale.rate(0.395)).toEqual({ score: 0.4, categoryIndex: 3, category: 'MARGINAL' });
  });

  it('rounds down a value just under a band edge', () => {
    expect(scale.rate(0.0949)).toEqual({ score: 0.09, categoryIndex: 1, category: 'UNSUITABLE' });
  });

  it('classifies a gap value between printed bands by its rounded score', () => {
    expect(scale.rate(0.699).categoryIndex).toBe(6);
    expect(scale.rate(0.694).categoryIndex).toBe(5);
  });

  it.each([-0.01, 1.01, Number.NaN, Number.POSITIVE_INFINITY])('rejects %s', (score) => {
    expect(() => scale.rate(score)).toThrow(RangeError);
  });
});
