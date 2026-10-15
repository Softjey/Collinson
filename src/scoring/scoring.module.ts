import { Module } from '@nestjs/common';
import { FeatureValuesMapper } from './mappers/feature-values.mapper.js';
import { ScoringService } from './scoring.service.js';

@Module({
  providers: [ScoringService, FeatureValuesMapper],
  exports: [ScoringService],
})
export class ScoringModule {}
