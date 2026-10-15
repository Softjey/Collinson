import { Module } from '@nestjs/common';
import { ClockModule } from '../shared/clock.module.js';
import { OpenMeteoModule } from '../shared/open-meteo/open-meteo.module.js';
import { ForecastClient } from './forecast.client.js';
import { ForecastRepository } from './repositories/forecast.repository.js';
import { LocationRepository } from './repositories/location.repository.js';
import { MarineClient } from './marine.client.js';
import { MarineRepository } from './repositories/marine.repository.js';
import { ForecastMapper } from './mappers/forecast.mapper.js';
import { MarineMapper } from './mappers/marine.mapper.js';
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
    ForecastMapper,
    MarineMapper,
  ],
  exports: [WeatherService],
})
export class WeatherModule {}
