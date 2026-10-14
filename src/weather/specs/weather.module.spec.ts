import { Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '../../shared/config/config.module.js';
import { DatabaseModule } from '../../shared/database/database.module.js';
import { PrismaService } from '../../shared/database/prisma.service.js';
import { LocationRepository } from '.././location.repository.js';
import { WeatherModule } from '.././weather.module.js';
import { WeatherService } from '.././weather.service.js';

@Module({ imports: [ConfigModule, DatabaseModule, WeatherModule] })
class ConsumerModule {}

describe('WeatherModule', () => {
  const original = { ...process.env };

  beforeEach(() => {
    process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/db';
  });

  afterEach(() => {
    process.env = { ...original };
  });

  async function compile() {
    return Test.createTestingModule({ imports: [ConsumerModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();
  }

  it('wires WeatherService with all its dependencies', async () => {
    const moduleRef = await compile();

    expect(moduleRef.get(WeatherService)).toBeInstanceOf(WeatherService);
  });

  it('exposes only WeatherService to importing modules', async () => {
    const moduleRef = await compile();

    expect(() => moduleRef.get(LocationRepository, { strict: true })).toThrow();
  });
});
