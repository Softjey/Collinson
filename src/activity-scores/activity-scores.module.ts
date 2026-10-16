import { Module } from '@nestjs/common';
import { LocationModule } from '../location/location.module.js';
import { ScoringModule } from '../scoring/scoring.module.js';
import { ClockModule } from '../shared/clock.module.js';
import { WeatherModule } from '../weather/weather.module.js';
import { ActivityScoresResolver } from './activity-scores.resolver.js';
import { ActivityScoresService } from './activity-scores.service.js';
import { DateRangeValidator } from './date-range.validator.js';
import { HourlyDataMapper } from './mappers/hourly-data.mapper.js';
import { ResultMapper } from './mappers/result.mapper.js';
import { TimeZoneService } from './time-zone.service.js';
import { ActivityScoresResultResolver, DayResultResolver } from './union-type.resolvers.js';
import { SourceResultCombiner } from './utils/source-result-combiner.js';

@Module({
  imports: [LocationModule, WeatherModule, ScoringModule, ClockModule],
  providers: [
    ActivityScoresResolver,
    ActivityScoresResultResolver,
    DayResultResolver,
    ActivityScoresService,
    TimeZoneService,
    DateRangeValidator,
    SourceResultCombiner,
    HourlyDataMapper,
    ResultMapper,
  ],
})
export class ActivityScoresModule {}
