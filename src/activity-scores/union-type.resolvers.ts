import { ResolveField, Resolver } from '@nestjs/graphql';
import type { ActivityScoresResult, DayResult } from './entities/activity-scores.result.js';

@Resolver('ActivityScoresResult')
export class ActivityScoresResultResolver {
  @ResolveField('__resolveType')
  resolveType(result: ActivityScoresResult): ActivityScoresResult['__typename'] {
    return result.__typename;
  }
}

@Resolver('DayResult')
export class DayResultResolver {
  @ResolveField('__resolveType')
  resolveType(result: DayResult): DayResult['__typename'] {
    return result.__typename;
  }
}
