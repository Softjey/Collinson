import { Injectable } from '@nestjs/common';
import type { DayConditions, FeatureValues } from '../entities/day-features.js';

/** Flattens the weather and marine features of a day into the one record that formulas read from. */
@Injectable()
export class FeatureValuesMapper {
  toFeatureValues({ weather, marine }: DayConditions): FeatureValues {
    return {
      ...weather,
      ...marine?.features,
      ...(marine ? { hasSea: marine.hasSea ? 1 : 0 } : {}),
    };
  }
}
