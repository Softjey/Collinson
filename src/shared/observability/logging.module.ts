import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/env.schema.js';

const HEALTH_PATH = '/health';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: ({ logLevel }: AppConfig) => ({
        pinoHttp: {
          level: logLevel,
          formatters: { level: (label: string) => ({ level: label }) },
          autoLogging: { ignore: (request) => request.url === HEALTH_PATH },
          serializers: {
            req: ({ id, method, url }: { id: unknown; method: string; url: string }) => ({ id, method, url }),
            res: ({ statusCode }: { statusCode: number }) => ({ statusCode }),
          },
        },
      }),
    }),
  ],
})
export class LoggingModule {}
