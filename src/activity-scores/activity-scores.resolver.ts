import { Args, Query, Resolver } from '@nestjs/graphql';
import { ActivityScoresInput } from './entities/activity-scores.input.js';

@Resolver()
export class ActivityScoresResolver {
  @Query('activityScores')
  activityScores(@Args('input') _input: ActivityScoresInput): never {
    throw new Error('activityScores is not implemented');
  }
}
