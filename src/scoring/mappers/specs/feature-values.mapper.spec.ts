import { buildWeatherFeatures } from '../../../../test/support/builders/day.js';
import { FeatureValuesMapper } from '../feature-values.mapper.js';

const mapper = new FeatureValuesMapper();
const weather = buildWeatherFeatures();
const features = { maxWaveHeightM: 1.2, maxWavePeriodS: 9 };

describe('FeatureValuesMapper.toFeatureValues', () => {
  it('merges weather and marine features into one flat record', () => {
    expect(mapper.toFeatureValues({ weather, marine: { hasSea: true, features } })).toEqual({
      ...weather,
      ...features,
      hasSea: 1,
    });
  });

  it('encodes a missing sea as 0', () => {
    expect(mapper.toFeatureValues({ weather, marine: { hasSea: false, features: null } }).hasSea).toBe(0);
  });

  it('leaves hasSea out when marine data was not requested', () => {
    expect(mapper.toFeatureValues({ weather, marine: null })).toEqual(weather);
  });

  it('works without weather', () => {
    expect(mapper.toFeatureValues({ weather: null, marine: { hasSea: true, features } })).toEqual({
      ...features,
      hasSea: 1,
    });
  });
});
