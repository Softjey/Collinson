import { Module } from '@nestjs/common';
import { ClockModule } from '../shared/clock.module.js';
import { OpenMeteoModule } from '../shared/open-meteo/open-meteo.module.js';
import { ForecastClient } from './forecast.client.js';
import { ForecastRepository } from './forecast.repository.js';
import { LocationRepository } from './location.repository.js';
import { MarineClient } from './marine.client.js';
import { MarineRepository } from './marine.repository.js';
import { WeatherService } from './weather.service.js';

@Module({
  imports: [OpenMeteoModule, ClockModule],
  providers: [
    WeatherService,
    LocationRepository,
    ForecastClient,
    MarineClient,
    ForecastRepository,
    MarineRepository,
  ],
  exports: [WeatherService],
})
export class WeatherModule {}
