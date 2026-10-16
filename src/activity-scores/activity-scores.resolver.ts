import { Args, Query, Resolver } from '@nestjs/graphql';
import { DateRangeValidator } from './date-range.validator.js';
import { ActivityScoresService } from './activity-scores.service.js';
import { ActivityScoresInput } from './entities/activity-scores.input.js';
import type { ActivityScores } from './entities/activity-scores.result.js';

@Resolver()
export class ActivityScoresResolver {
  constructor(private readonly activityScoresService: ActivityScoresService) {}

  @Query('activityScores')
  activityScores(@Args('input', DateRangeValidator) input: ActivityScoresInput): Promise<ActivityScores> {
    return this.activityScoresService.scoreActivities(input);
  }
}
