import { Global, Module } from '@nestjs/common';
import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/env.schema.js';
import { OpenMeteoHttpClient } from './open-meteo-http.client.js';

@Global()
@Module({
  providers: [
    {
      provide: OpenMeteoHttpClient,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => new OpenMeteoHttpClient(config.openMeteo, fetch),
    },
  ],
  exports: [OpenMeteoHttpClient],
})
export class OpenMeteoModule {}
