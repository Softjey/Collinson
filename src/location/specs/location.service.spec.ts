import { jest } from '@jest/globals';
import type { Location } from '../entities/location.js';
import { LocationService } from '../location.service.js';
import type { LocationRepository } from '../repositories/location.repository.js';

function setup() {
  const locationRepository = {
    findOrCreate: jest.fn(async (input: Omit<Location, 'id'>) => ({ id: 1, ...input })),
    findElevation: jest.fn(async () => 12 as number | null),
  };
  const service = new LocationService(locationRepository as unknown as LocationRepository);
  return { service, locationRepository };
}

describe('LocationService', () => {
  describe('findOrCreate', () => {
    it('finds or creates the location with rounded coordinates and the time zone', async () => {
      const { service, locationRepository } = setup();

      const result = await service.findOrCreate(41.404, -2.178, 'Europe/Madrid');

      expect(locationRepository.findOrCreate).toHaveBeenCalledWith({
        latE2: 4140,
        lonE2: -218,
        timezone: 'Europe/Madrid',
      });
      expect(result).toEqual({ id: 1, latE2: 4140, lonE2: -218, timezone: 'Europe/Madrid' });
    });
  });

  describe('getElevation', () => {
    const location: Location = { id: 7, latE2: 4140, lonE2: 218, timezone: 'Europe/Madrid' };

    it('reads the elevation stored for the location', async () => {
      const { service, locationRepository } = setup();

      expect(await service.getElevation(location)).toBe(12);
      expect(locationRepository.findElevation).toHaveBeenCalledWith(7);
    });

    it('returns null when no elevation has been stored yet', async () => {
      const { service, locationRepository } = setup();
      locationRepository.findElevation.mockResolvedValue(null);

      expect(await service.getElevation(location)).toBeNull();
    });
  });
});
