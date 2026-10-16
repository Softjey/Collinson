import type { Activity } from '../../scoring/entities/activity.js';
import type { DataSource, UnscoredReason } from '../../scoring/entities/day-features.js';
import type { RatedScore } from '../../scoring/entities/rated-score.js';
import type { LocalDate } from '../../shared/local-date.js';
import type { SourceFailureCause } from '../../weather/entities/weather.types.js';

export interface ScoredDay extends RatedScore {
  __typename: 'ScoredDay';
  date: LocalDate;
}

export interface UnscoredDay {
  __typename: 'UnscoredDay';
  date: LocalDate;
  reason: UnscoredReason;
}

export type DayResult = ScoredDay | UnscoredDay;

export interface DataFreshness {
  kind: DataSource;
  updatedAt: Date;
  stale: boolean;
}

export interface ActivityDayScores {
  __typename: 'ActivityDayScores';
  activity: Activity;
  days: DayResult[];
  freshness: DataFreshness[];
}

export interface ActivityDataTooOld {
  __typename: 'ActivityDataTooOld';
  activity: Activity;
  lastUpdatedAt: Date;
}

export interface ActivityDataUnavailable {
  __typename: 'ActivityDataUnavailable';
  activity: Activity;
  cause: SourceFailureCause;
}

export type ActivityScoresResult = ActivityDayScores | ActivityDataTooOld | ActivityDataUnavailable;

export interface ScoredLocation {
  latitude: number;
  longitude: number;
  elevation: number | null;
  timezone: string;
}

export interface ActivityScores {
  location: ScoredLocation;
  activities: ActivityScoresResult[];
}
