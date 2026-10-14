import { Injectable } from '@nestjs/common';
import type { Activity } from './entities/activity.js';
import { findDefinition, requiredSources } from './utils/definition-lookup.js';
import type { DataSource, DayContext, DayOutcome } from './entities/definition.types.js';
import { scoreDay } from './utils/score-day.js';

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
