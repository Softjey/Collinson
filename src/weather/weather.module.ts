import { Module } from '@nestjs/common';
import { Clock } from '../shared/clock.js';
import { ClockModule } from '../shared/clock.module.js';
import { APP_CONFIG } from '../shared/config/config.module.js';
import type { AppConfig } from '../shared/config/env.schema.js';
import { OpenMeteoModule } from '../shared/open-meteo/open-meteo.module.js';
import { ForecastClient } from './forecast.client.js';
import { ForecastSnapshotRepository } from './forecast-snapshot.repository.js';
import { LocationRepository } from './location.repository.js';
import { MarineClient } from './marine.client.js';
import { MarineSnapshotRepository } from './marine-snapshot.repository.js';
import { WeatherService } from './weather.service.js';

@Module({
  imports: [OpenMeteoModule, ClockModule],
  providers: [
    LocationRepository,
    ForecastClient,
    MarineClient,
    ForecastSnapshotRepository,
    MarineSnapshotRepository,
    {
      provide: WeatherService,
      inject: [
        Clock,
        APP_CONFIG,
        LocationRepository,
        ForecastClient,
        MarineClient,
        ForecastSnapshotRepository,
        MarineSnapshotRepository,
      ],
      useFactory: (
        clock: Clock,
        config: AppConfig,
        locations: LocationRepository,
        forecastClient: ForecastClient,
        marineClient: MarineClient,
        forecastSnapshots: ForecastSnapshotRepository,
        marineSnapshots: MarineSnapshotRepository,
      ) =>
        new WeatherService({
          clock,
          locations,
          forecastClient,
          marineClient,
          forecastSnapshots,
          marineSnapshots,
          settings: {
            forecastRefreshHours: config.weatherRefreshHours,
            marineRefreshHours: config.wavesRefreshHours,
            maxStaleHours: config.maxStaleHours,
          },
        }),
    },
  ],
  exports: [WeatherService],
})
export class WeatherModule {}
