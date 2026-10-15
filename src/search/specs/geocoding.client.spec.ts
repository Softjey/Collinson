import { jest } from '@jest/globals';
import type { OpenMeteoService } from '../../shared/open-meteo/open-meteo.service.js';
import type { Place } from '../entities/place.js';
import { buildPlace } from '../../../test/support/builders/place.js';
import { GeocodingClient } from '../geocoding.client.js';

const place = buildPlace(3080165, {
  name: 'Zakopane',
  country: 'Poland',
  countryCode: 'PL',
  admin1: 'Lesser Poland',
  latitude: 49.29899,
  longitude: 19.94885,
  elevation: 838,
  timezone: 'Europe/Warsaw',
  population: 27266,
});

function createClient(results: Place[]) {
  const geocoding = jest
    .fn<(params: object) => Promise<{ results: Place[] }>>()
    .mockResolvedValue({ results });
  const client = new GeocodingClient({ geocoding } as unknown as OpenMeteoService);
  return { client, geocoding };
}

describe('GeocodingClient', () => {
  it('returns the places in the order of the response', async () => {
    const { client } = createClient([place, buildPlace(7531875)]);

    const places = await client.search({ name: 'Zakopane', count: 2, language: 'en' });

    expect(places.map(({ id }) => id)).toEqual([3080165, 7531875]);
  });

  it('returns an empty list when there are no results', async () => {
    const { client } = createClient([]);

    await expect(client.search({ name: 'Nowhereville', count: 5, language: 'en' })).resolves.toEqual([]);
  });

  it('sends name, count, language and the country code when given', async () => {
    const { client, geocoding } = createClient([]);

    await client.search({ name: 'Rome', count: 3, language: 'it', countryCode: 'IT' });

    expect(geocoding).toHaveBeenCalledWith({ name: 'Rome', count: 3, language: 'it', countryCode: 'IT' });
  });

  it('leaves the country code out when it is not given', async () => {
    const { client, geocoding } = createClient([]);

    await client.search({ name: 'Rome', count: 3, language: 'en' });

    expect(geocoding).toHaveBeenCalledWith({
      name: 'Rome',
      count: 3,
      language: 'en',
      countryCode: undefined,
    });
  });

  it('propagates geocoder failures', async () => {
    const geocoding = jest.fn<(params: object) => Promise<unknown>>().mockRejectedValue(new Error('down'));
    const client = new GeocodingClient({ geocoding } as unknown as OpenMeteoService);

    await expect(client.search({ name: 'Rome', count: 3, language: 'en' })).rejects.toThrow('down');
  });
});
