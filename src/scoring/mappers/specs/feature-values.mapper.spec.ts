import type { DayContext } from '../../entities/definition.types.js';
import { toFeatureValues } from '../feature-values.mapper.js';

const weather = { tMax: 10, rhMean: 50 } as unknown as NonNullable<DayContext['weather']>;
const features = { waveHeight: 1.2, wavePeriod: 9 };

describe('toFeatureValues', () => {
  it('merges weather and marine features into one flat record', () => {
    expect(toFeatureValues({ weather, marine: { hasSea: true, features } })).toEqual({
      tMax: 10,
      rhMean: 50,
      waveHeight: 1.2,
      wavePeriod: 9,
      hasSea: 1,
    });
  });

  it('encodes a missing sea as 0', () => {
    expect(toFeatureValues({ weather, marine: { hasSea: false, features: null } }).hasSea).toBe(0);
  });

  it('leaves hasSea out when marine data was not requested', () => {
    expect(toFeatureValues({ weather, marine: null })).toEqual({ tMax: 10, rhMean: 50 });
  });

  it('works without weather', () => {
    expect(toFeatureValues({ weather: null, marine: { hasSea: true, features } })).toEqual({
      ...features,
      hasSea: 1,
    });
  });
});
