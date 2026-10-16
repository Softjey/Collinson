import { Injectable } from '@nestjs/common';
import type { SourceFailureCause, SourceResult } from '../../weather/entities/weather.types.js';

export type CombinedSourceResult =
  | { status: 'ok' }
  | { status: 'too_old'; lastUpdatedAt: Date }
  | { status: 'unavailable'; cause: SourceFailureCause };

/** Decides whether the sources an activity needs, taken together, allow it to be scored. */
@Injectable()
export class SourceResultCombiner {
  combine(results: readonly SourceResult<unknown>[]): CombinedSourceResult {
    const failureCauses = results.flatMap((result) =>
      result.status === 'unavailable' ? [result.cause] : [],
    );
    if (failureCauses.length > 0) {
      return {
        status: 'unavailable',
        cause: failureCauses.includes('RATE_LIMITED') ? 'RATE_LIMITED' : failureCauses[0],
      };
    }

    const tooOldTimes = results.flatMap((result) =>
      result.status === 'too_old' ? [result.fetchedAt.getTime()] : [],
    );
    if (tooOldTimes.length > 0) {
      return { status: 'too_old', lastUpdatedAt: new Date(Math.min(...tooOldTimes)) };
    }

    return { status: 'ok' };
  }
}
