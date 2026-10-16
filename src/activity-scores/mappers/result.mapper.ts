import { Injectable } from '@nestjs/common';
import type { Activity } from '../../scoring/entities/activity.js';
import type { DataSource, DayOutcome } from '../../scoring/entities/day-features.js';
import { ScoringService } from '../../scoring/scoring.service.js';
import type { LocalDate } from '../../shared/local-date.js';
import type { SourceFailureCause, SourceResult } from '../../weather/entities/weather.types.js';
import type {
  ActivityDataTooOld,
  ActivityDataUnavailable,
  ActivityDayScores,
  DataFreshness,
  DayResult,
  ScoredLocation,
} from '../entities/activity-scores.result.js';

/** Translates scoring and weather outcomes into the types of the GraphQL contract. */
@Injectable()
export class ResultMapper {
  constructor(private readonly scoringService: ScoringService) {}

  toDayResult(date: LocalDate, outcome: DayOutcome): DayResult {
    if (outcome.kind === 'unscored') {
      return { __typename: 'UnscoredDay', date, reason: outcome.reason };
    }
    return { __typename: 'ScoredDay', date, ...this.scoringService.rate(outcome.score) };
  }

  toFreshness(kind: DataSource, result: Extract<SourceResult<unknown>, { status: 'ok' }>): DataFreshness {
    return { kind, updatedAt: result.fetchedAt, stale: result.stale };
  }

  toActivityDayScores(activity: Activity, days: DayResult[], freshness: DataFreshness[]): ActivityDayScores {
    return { __typename: 'ActivityDayScores', activity, days, freshness };
  }

  toDataTooOld(activity: Activity, lastUpdatedAt: Date): ActivityDataTooOld {
    return { __typename: 'ActivityDataTooOld', activity, lastUpdatedAt };
  }

  toDataUnavailable(activity: Activity, cause: SourceFailureCause): ActivityDataUnavailable {
    return { __typename: 'ActivityDataUnavailable', activity, cause };
  }

  toLocation(point: Omit<ScoredLocation, 'elevation'>, elevation: number | null): ScoredLocation {
    return { ...point, elevation };
  }
}
