import { Injectable } from '@nestjs/common';
import type { DayContext } from '../entities/definition.types.js';
import type { FeatureValues } from '../utils/derived-features.js';

@Injectable()
export class FeatureValuesMapper {
  toFeatureValues({ weather, marine }: DayContext): FeatureValues {
    return {
      ...weather,
      ...marine?.features,
      ...(marine ? { hasSea: marine.hasSea ? 1 : 0 } : {}),
    };
  }
}
