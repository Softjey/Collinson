import { Module } from '@nestjs/common';
import { ActivityScoresModule } from './activity-scores/activity-scores.module.js';
import { ScoringModule } from './scoring/scoring.module.js';
import { SearchModule } from './search/search.module.js';
import { WeatherModule } from './weather/weather.module.js';

@Module({
  imports: [ScoringModule, WeatherModule, SearchModule, ActivityScoresModule],
})
export class AppModule {}
