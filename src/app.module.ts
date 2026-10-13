import { Module } from '@nestjs/common';
import { ConfigModule } from './shared/config/config.module.js';
import { DatabaseModule } from './shared/database/database.module.js';
import { ActivityScoresModule } from './activity-scores/activity-scores.module.js';
import { ScoringModule } from './scoring/scoring.module.js';
import { SearchModule } from './search/search.module.js';
import { WeatherModule } from './weather/weather.module.js';

@Module({
  imports: [ConfigModule, DatabaseModule, ScoringModule, WeatherModule, SearchModule, ActivityScoresModule],
})
export class AppModule {}
