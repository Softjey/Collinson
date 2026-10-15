import { BARCELONA } from '../../../../test/support/builders/weather.js';
import { useTestDatabase } from '../../../../test/support/database.js';
import { LocationRepository } from '../location.repository.js';

describe('LocationRepository', () => {
  const database = useTestDatabase();
  let locations: LocationRepository;

  beforeAll(() => {
    locations = new LocationRepository(database.prisma);
  });

  it('creates a location with its time zone', async () => {
    const location = await locations.findOrCreate(BARCELONA);

    expect(location).toEqual({ id: expect.any(Number), ...BARCELONA });
    expect(await database.prisma.location.count()).toBe(1);
  });

  it('is idempotent', async () => {
    const first = await locations.findOrCreate(BARCELONA);
    const second = await locations.findOrCreate(BARCELONA);

    expect(second).toEqual(first);
    expect(await database.prisma.location.count()).toBe(1);
  });

  it('is safe under concurrent calls', async () => {
    const results = await Promise.all([
      locations.findOrCreate(BARCELONA),
      locations.findOrCreate(BARCELONA),
      locations.findOrCreate(BARCELONA),
    ]);

    expect(new Set(results.map((location) => location.id)).size).toBe(1);
    expect(await database.prisma.location.count()).toBe(1);
  });

  it('keeps the stored time zone when called with another one', async () => {
    await locations.findOrCreate(BARCELONA);

    const again = await locations.findOrCreate({ ...BARCELONA, timezone: 'UTC' });

    expect(again.timezone).toBe('Europe/Madrid');
  });

  it('fills in a missing time zone', async () => {
    const { id } = await locations.findOrCreate(BARCELONA);
    await database.prisma.location.update({ where: { id }, data: { timezone: null } });

    const again = await locations.findOrCreate(BARCELONA);

    expect(again).toMatchObject({ id, timezone: 'Europe/Madrid' });
    await expect(database.prisma.location.findUnique({ where: { id } })).resolves.toMatchObject({
      timezone: 'Europe/Madrid',
    });
  });

  it('keeps locations that differ in one coordinate apart', async () => {
    const a = await locations.findOrCreate(BARCELONA);
    const b = await locations.findOrCreate({ ...BARCELONA, lonE2: 219 });

    expect(b.id).not.toBe(a.id);
  });

  it('keeps the stored time zone when asked again with another one', async () => {
    await locations.findOrCreate(BARCELONA);

    const again = await locations.findOrCreate({ ...BARCELONA, timezone: 'Europe/Paris' });

    expect(again.timezone).toBe('Europe/Madrid');
  });

  it('fills in a missing time zone', async () => {
    await database.prisma.location.create({ data: { latE2: 4140, lonE2: 218 } });

    const location = await locations.findOrCreate(BARCELONA);

    expect(location.timezone).toBe('Europe/Madrid');
  });

  it('updates the elevation', async () => {
    const location = await locations.findOrCreate(BARCELONA);

    await locations.updateElevation(location.id, 33.5);

    const row = await database.prisma.location.findUniqueOrThrow({ where: { id: location.id } });
    expect(row.elevationM).toBe(33.5);
  });

  it('reads the elevation', async () => {
    const location = await locations.findOrCreate(BARCELONA);
    await locations.updateElevation(location.id, 33.5);

    expect(await locations.findElevation(location.id)).toBe(33.5);
  });

  it('reads no elevation before one was stored', async () => {
    const location = await locations.findOrCreate(BARCELONA);

    expect(await locations.findElevation(location.id)).toBeNull();
  });
});
