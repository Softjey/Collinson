import { Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '../../shared/config/config.module.js';
import { DatabaseModule } from '../../shared/database/database.module.js';
import { PrismaService } from '../../shared/database/prisma.service.js';
import { LocationModule } from '../location.module.js';
import { LocationService } from '../location.service.js';
import { LocationRepository } from '../repositories/location.repository.js';

@Module({ imports: [ConfigModule, DatabaseModule, LocationModule] })
class ConsumerModule {}

describe('LocationModule', () => {
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

  it('wires LocationService with its repository', async () => {
    const moduleRef = await compile();

    expect(moduleRef.get(LocationService)).toBeInstanceOf(LocationService);
  });

  it('exposes only LocationService to importing modules', async () => {
    const moduleRef = await compile();

    expect(() => moduleRef.get(LocationRepository, { strict: true })).toThrow();
  });
});
