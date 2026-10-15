import { Module } from '@nestjs/common';
import { ALL_ACTIVITY_SCORERS } from './entities/activities.js';
import { ActivityCatalogue } from './entities/activity-scorers.js';
import { ScoreScale } from './entities/score-scale.js';
import { DailyFeaturesMapper } from './mappers/daily-features.mapper.js';
import { FeatureValuesMapper } from './mappers/feature-values.mapper.js';
import { ScoringService } from './scoring.service.js';

@Module({
  providers: [
    ScoringService,
    DailyFeaturesMapper,
    FeatureValuesMapper,
    ScoreScale,
    { provide: ActivityCatalogue, useFactory: () => new ActivityCatalogue(ALL_ACTIVITY_SCORERS) },
  ],
  exports: [ScoringService],
})
export class ScoringModule {}
