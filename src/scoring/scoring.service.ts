import { Injectable } from '@nestjs/common';
import type { Activity } from './entities/activity.js';
import { findDefinition, requiredSources } from './utils/definition-lookup.js';
import type { DataSource, DayContext, DayOutcome } from './entities/definition.types.js';
import { FeatureValuesMapper } from './mappers/feature-values.mapper.js';
import { scoreFeatures } from './utils/score-day.js';

export interface ActivityOutcome {
  activity: Activity;
  outcome: DayOutcome;
}

@Injectable()
export class ScoringService {
  constructor(private readonly mapper: FeatureValuesMapper) {}

  score(activities: readonly Activity[], day: DayContext): ActivityOutcome[] {
    const features = this.mapper.toFeatureValues(day);
    return activities.map((activity) => ({
      activity,
      outcome: scoreFeatures(findDefinition(activity), features),
    }));
  }

  requiredSources(activities: readonly Activity[]): DataSource[] {
    return requiredSources(activities);
  }
}
