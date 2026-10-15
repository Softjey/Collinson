import type { Activity } from '../entities/activity.js';
import type { DataSource } from '../entities/day-features.js';
import type { ActivityScorer } from './activity-scorers.js';

/** The scorers available to the service, looked up by activity. */
export class ActivityCatalogue {
  constructor(private readonly scorers: readonly ActivityScorer[]) {}

  scorerFor(activity: Activity): ActivityScorer {
    const matches = this.scorers.filter((scorer) => scorer.activity === activity);
    if (matches.length === 0) throw new Error(`No scorer for ${activity}`);
    if (matches.length > 1) throw new Error(`Duplicate scorer for ${activity}`);
    return matches[0];
  }

  requiredSourcesOf(activities: readonly Activity[]): DataSource[] {
    const sources = new Set<DataSource>();
    for (const activity of activities) {
      for (const source of this.scorerFor(activity).requiredSources) sources.add(source);
    }
    return [...sources];
  }
}
