import { Injectable } from '@nestjs/common';
import type { Activity } from './activity.js';
import { findDefinition, requiredSources } from './definition-lookup.js';
import type { DataSource, DayContext, DayOutcome } from './definition.types.js';
import { scoreDay } from './score-day.js';

export interface ActivityOutcome {
  activity: Activity;
  outcome: DayOutcome;
}

@Injectable()
export class ScoringService {
  score(activities: readonly Activity[], day: DayContext): ActivityOutcome[] {
    return activities.map((activity) => ({ activity, outcome: scoreDay(findDefinition(activity), day) }));
  }

  requiredSources(activities: readonly Activity[]): DataSource[] {
    return requiredSources(activities);
  }
}
