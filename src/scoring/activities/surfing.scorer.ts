import { Injectable } from '@nestjs/common';
import type { ActivityScorer, DataSource, DayContext, DayOutcome } from '../activity-scorer.js';
import { scored, unscored } from '../activity-scorer.js';
import type { Activity } from '../activity.js';
import { interpolate } from '../math.js';
import { SURFING_PARAMS } from '../scoring.params.js';

export const waveHeightUtility = (waveHeight: number): number =>
  interpolate(SURFING_PARAMS.waveHeight, waveHeight);

export const wavePeriodUtility = (wavePeriod: number): number =>
  interpolate(SURFING_PARAMS.wavePeriod, wavePeriod);

export const windUtility = (windMax: number): number => interpolate(SURFING_PARAMS.wind, windMax);

@Injectable()
export class SurfingScorer implements ActivityScorer {
  readonly activity: Activity = 'SURFING';
  readonly requiredSources: readonly DataSource[] = ['WEATHER', 'WAVES'];

  evaluate({ weather, marine }: DayContext): DayOutcome {
    if (marine && !marine.hasSea) return unscored('NO_SEA');

    const windMax = weather?.windMax ?? null;
    const waveHeight = marine?.features?.waveHeight ?? null;
    const wavePeriod = marine?.features?.wavePeriod ?? null;
    if (windMax === null || waveHeight === null || wavePeriod === null) return unscored('NO_DATA');

    const heightUtility = waveHeightUtility(waveHeight);
    const periodUtility = wavePeriodUtility(wavePeriod);
    const speedUtility = windUtility(windMax);
    if (heightUtility === 0 || periodUtility === 0 || speedUtility === 0) return scored(0);

    const { exponents } = SURFING_PARAMS;
    return scored(
      heightUtility ** exponents.waveHeight *
        periodUtility ** exponents.wavePeriod *
        speedUtility ** exponents.wind,
    );
  }
}
