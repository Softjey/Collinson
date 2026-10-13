import { Inject, Injectable } from '@nestjs/common';
import { ACTIVITY_SCORERS, type ActivityScorer, type DataSource } from './activity-scorer.js';
import type { Activity } from './activity.js';

@Injectable()
export class ScorerRegistry {
  private readonly byActivity = new Map<Activity, ActivityScorer>();

  constructor(@Inject(ACTIVITY_SCORERS) scorers: ActivityScorer[]) {
    for (const scorer of scorers) {
      if (this.byActivity.has(scorer.activity)) {
        throw new Error(`Duplicate scorer for ${scorer.activity}`);
      }
      this.byActivity.set(scorer.activity, scorer);
    }
  }

  get(activity: Activity): ActivityScorer {
    const scorer = this.byActivity.get(activity);
    if (!scorer) throw new Error(`No scorer registered for ${activity}`);
    return scorer;
  }

  requiredSources(activities: readonly Activity[]): DataSource[] {
    const sources = new Set<DataSource>();
    for (const activity of activities) {
      for (const source of this.get(activity).requiredSources) sources.add(source);
    }
    return [...sources];
  }
}
