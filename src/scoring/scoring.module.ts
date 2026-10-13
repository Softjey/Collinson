import { Module } from '@nestjs/common';
import { IndoorSightseeingScorer } from './activities/indoor.scorer.js';
import { OutdoorSightseeingScorer } from './activities/outdoor.scorer.js';
import { SkiingScorer } from './activities/skiing.scorer.js';
import { SurfingScorer } from './activities/surfing.scorer.js';
import { ACTIVITY_SCORERS, type ActivityScorer } from './activity-scorer.js';
import { ScorerRegistry } from './scorer.registry.js';

const SCORERS = [SkiingScorer, SurfingScorer, OutdoorSightseeingScorer, IndoorSightseeingScorer];

@Module({
  providers: [
    ...SCORERS,
    {
      provide: ACTIVITY_SCORERS,
      useFactory: (...scorers: ActivityScorer[]) => scorers,
      inject: SCORERS,
    },
    ScorerRegistry,
  ],
  exports: [ScorerRegistry],
})
export class ScoringModule {}
