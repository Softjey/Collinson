import { HttpModule, HttpService } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/env.schema.js';
import { OpenMeteoHttpClient } from './open-meteo-http.client.js';
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
      inject: [HttpService, APP_CONFIG],
      useFactory: (http: HttpService, { openMeteo }: AppConfig) => {
        const client = (baseUrl: string) =>
          new OpenMeteoHttpClient(http, { baseUrl, retries: openMeteo.retries, apiKey: openMeteo.apiKey });
        return new OpenMeteoService({
          forecast: client(openMeteo.forecastUrl),
          marine: client(openMeteo.marineUrl),
          geocoding: client(openMeteo.geocodingUrl),
        });
      },
    },
  ],
  exports: [OpenMeteoService],
})
export class OpenMeteoModule {}
