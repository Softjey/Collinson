import { HttpModule, HttpService } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/env.schema.js';
import { Metrics } from '../observability/metrics.js';
import { OpenMeteoHttpClient, type OpenMeteoSource } from './open-meteo-http.client.js';
import { OpenMeteoService } from './open-meteo.service.js';

@Module({
  imports: [
    HttpModule.registerAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({ timeout: config.openMeteo.timeoutMs }),
    }),
  ],
  providers: [
    {
      provide: OpenMeteoService,
      inject: [HttpService, APP_CONFIG, Metrics],
      useFactory: (http: HttpService, { openMeteo }: AppConfig, metrics: Metrics) => {
        const client = (source: OpenMeteoSource, baseUrl: string) =>
          new OpenMeteoHttpClient(http, {
            source,
            baseUrl,
            retries: openMeteo.retries,
            apiKey: openMeteo.apiKey,
            metrics,
          });
        return new OpenMeteoService({
          forecast: client('forecast', openMeteo.forecastUrl),
          marine: client('marine', openMeteo.marineUrl),
          geocoding: client('geocoding', openMeteo.geocodingUrl),
        });
      },
    },
  ],
  exports: [OpenMeteoService],
})
export class OpenMeteoModule {}
