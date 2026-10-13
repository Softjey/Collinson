import { Module } from '@nestjs/common';
import { ActivityScoresResolver } from './activity-scores.resolver.js';

@Module({
  providers: [ActivityScoresResolver],
})
export class ActivityScoresModule {}
