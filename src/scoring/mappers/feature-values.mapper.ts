import type { DayContext } from '../entities/definition.types.js';
import type { FeatureValues } from '../utils/derived-features.js';

export function toFeatureValues({ weather, marine }: DayContext): FeatureValues {
  return {
    ...weather,
    ...marine?.features,
    ...(marine ? { hasSea: marine.hasSea ? 1 : 0 } : {}),
  };
}
