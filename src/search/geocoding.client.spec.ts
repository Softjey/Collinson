import { readFileSync } from 'node:fs';
import { jest } from '@jest/globals';
import type { OpenMeteoService } from '../shared/open-meteo/open-meteo.service.js';
import { GeocodingClient } from './geocoding.client.js';

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`../../test/fixtures/search/${name}`, import.meta.url), 'utf8'));
}

function createClient(response: unknown) {
  const geocoding = jest.fn<(params: object) => Promise<unknown>>().mockResolvedValue(response);
  const client = new GeocodingClient({ geocoding } as unknown as OpenMeteoService);
  return { client, geocoding };
}

describe('GeocodingClient', () => {
  it('maps a full result', async () => {
    const { client } = createClient(fixture('geocoding-zakopane.json'));

    const [place] = await client.search({ name: 'Zakopane', count: 2, language: 'en' });

    expect(place).toEqual({
      id: '3080165',
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
  });

  it('maps a result with only the required fields', async () => {
    const { client } = createClient(fixture('geocoding-zakopane.json'));

    const places = await client.search({ name: 'Zakopane', count: 2, language: 'en' });

    expect(places[1]).toEqual({
      id: '7531875',
      name: 'Zakopane',
      country: null,
      countryCode: null,
      admin1: null,
      latitude: 49.3,
      longitude: 19.95,
      elevation: null,
      timezone: null,
      population: null,
    });
  });

  it('keeps the order of the response', async () => {
    const { client } = createClient(fixture('geocoding-zakopane.json'));

    const places = await client.search({ name: 'Zakopane', count: 2, language: 'en' });

    expect(places.map((place) => place.id)).toEqual(['3080165', '7531875']);
  });

  it('returns an empty list when the response has no results', async () => {
    const { client } = createClient(fixture('geocoding-empty.json'));

    await expect(client.search({ name: 'Nowhereville', count: 5, language: 'en' })).resolves.toEqual([]);
  });

  it('rejects malformed results', async () => {
    const { client } = createClient(fixture('geocoding-malformed.json'));

    await expect(client.search({ name: 'Zakopane', count: 5, language: 'en' })).rejects.toThrow();
  });

  it('rejects a body that is not an object', async () => {
    const { client } = createClient('<html>');

    await expect(client.search({ name: 'Zakopane', count: 5, language: 'en' })).rejects.toThrow();
  });

  it('sends name, count and language, and the country code when given', async () => {
    const { client, geocoding } = createClient({});

    await client.search({ name: 'Rome', count: 3, language: 'it', countryCode: 'IT' });

    expect(geocoding).toHaveBeenCalledWith({ name: 'Rome', count: 3, language: 'it', countryCode: 'IT' });
  });

  it('omits the country code when it is not given', async () => {
    const { client, geocoding } = createClient({});

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
