import { fileURLToPath } from 'node:url';
import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import { Module, ValidationPipe } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { ActivityScoresModule } from './activity-scores/activity-scores.module.js';
import { HealthModule } from './health/health.module.js';
import { ScoringModule } from './scoring/scoring.module.js';
import { SearchModule } from './search/search.module.js';
import { ConfigModule } from './shared/config/config.module.js';
import { DatabaseModule } from './shared/database/database.module.js';
import { formatGraphQLError } from './shared/graphql/error-formatter.js';
import { ScalarsModule } from './shared/graphql/scalars.module.js';
import { OpenMeteoModule } from './shared/open-meteo/open-meteo.module.js';
import { WeatherModule } from './weather/weather.module.js';

const CONTRACT_PATH = fileURLToPath(new URL('../contracts/graphql/schema.graphql', import.meta.url));

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    OpenMeteoModule,
    ScalarsModule,
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      typePaths: [CONTRACT_PATH],
      playground: false,
      introspection: true,
      includeStacktraceInErrorResponses: false,
      formatError: formatGraphQLError,
    }),
    ScoringModule,
    WeatherModule,
    SearchModule,
    ActivityScoresModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({ transform: true, whitelist: true }),
    },
  ],
})
export class AppModule {}
