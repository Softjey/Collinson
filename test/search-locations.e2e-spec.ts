import { OpenMeteoUnavailableError } from '../src/shared/open-meteo/open-meteo.errors.js';
import { graphqlRequest, useTestApp } from './support/app.js';
import { useTestDatabase } from './support/database.js';
import { DAY_MS, moveClockTo, restoreClock } from './support/fake-clock.js';
import { loadFixture } from './support/fixtures.js';
import { SEARCH_LOCATIONS } from './support/queries.js';

describe('searchLocations', () => {
  const testApp = useTestApp();
  useTestDatabase();

  afterEach(restoreClock);

  const search = (variables: Record<string, unknown>) => graphqlRequest(testApp, SEARCH_LOCATIONS, variables);
  const searchZakopane = () => search({ name: 'Zakopane', count: 2 });

  const geocoderCalls = () => testApp.openMeteo.calls.filter((call) => call.endpoint === 'geocoding');

  const scriptZakopane = () =>
    testApp.openMeteo.respond('geocoding', loadFixture('search/geocoding-zakopane.json'));

  it('calls the geocoder once and returns the places in order', async () => {
    scriptZakopane();

    const response = await searchZakopane();

    expect(response.body.errors).toBeUndefined();
    expect(geocoderCalls()).toHaveLength(1);
    expect(response.body.data.searchLocations).toEqual([
      {
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
      },
      {
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
      },
    ]);
  });

  it('serves the same search again without calling the geocoder', async () => {
    scriptZakopane();
    const first = await searchZakopane();

    const second = await searchZakopane();

    expect(geocoderCalls()).toHaveLength(1);
    expect(second.body.data).toEqual(first.body.data);
  });

  it.each(['zakopane', '  Zakopane ', 'ZAKOPANE'])('treats "%s" as the same search', async (name) => {
    scriptZakopane();
    await searchZakopane();

    const response = await search({ name, count: 2 });

    expect(response.body.errors).toBeUndefined();
    expect(geocoderCalls()).toHaveLength(1);
  });

  it.each([
    ['count', { name: 'Zakopane', count: 3 }],
    ['language', { name: 'Zakopane', count: 2, language: 'pl' }],
    ['country code', { name: 'Zakopane', count: 2, countryCode: 'PL' }],
  ])('treats a different %s as a different search', async (_label, variables) => {
    scriptZakopane();
    await searchZakopane();

    await search(variables);

    expect(geocoderCalls()).toHaveLength(2);
  });

  it('returns an empty result as [] and caches it', async () => {
    testApp.openMeteo.respond('geocoding', loadFixture('search/geocoding-empty.json'));

    const first = await search({ name: 'Nowhereville' });
    const second = await search({ name: 'Nowhereville' });

    expect(first.body.data.searchLocations).toEqual([]);
    expect(second.body.data.searchLocations).toEqual([]);
    expect(geocoderCalls()).toHaveLength(1);
  });

  it('sends count 10 and language en when they are omitted', async () => {
    scriptZakopane();

    await search({ name: 'Zakopane' });

    expect(geocoderCalls()[0].params).toMatchObject({ name: 'Zakopane', count: 10, language: 'en' });
  });

  it('sends the trimmed name and the upper-cased country code', async () => {
    scriptZakopane();

    await search({ name: '  Zakopane ', count: 2, countryCode: 'pl' });

    expect(geocoderCalls()[0].params).toMatchObject({ name: 'Zakopane', countryCode: 'PL' });
  });

  describe('cache lifetime', () => {
    it('refetches a search that is older than 30 days and replaces its hits', async () => {
      const start = Date.now();
      scriptZakopane();
      await searchZakopane();
      testApp.openMeteo.respond('geocoding', {
        results: [{ id: 99, name: 'Zakopane Nowe', latitude: 1, longitude: 2 }],
      });

      moveClockTo(start + 31 * DAY_MS);
      const response = await searchZakopane();

      expect(geocoderCalls()).toHaveLength(2);
      expect(response.body.data.searchLocations.map((place: { id: string }) => place.id)).toEqual(['99']);
    });

    it('still serves a search that is 29 days old', async () => {
      const start = Date.now();
      scriptZakopane();
      await searchZakopane();

      moveClockTo(start + 29 * DAY_MS);
      await searchZakopane();

      expect(geocoderCalls()).toHaveLength(1);
    });
  });

  describe('geocoder failures', () => {
    const fail = () =>
      testApp.openMeteo.respond('geocoding', () => {
        throw new OpenMeteoUnavailableError('down');
      });

    it('returns the stored result of any age when the geocoder is down', async () => {
      const start = Date.now();
      scriptZakopane();
      const first = await searchZakopane();
      fail();

      moveClockTo(start + 90 * DAY_MS);
      const response = await searchZakopane();

      expect(geocoderCalls()).toHaveLength(2);
      expect(response.body.errors).toBeUndefined();
      expect(response.body.data).toEqual(first.body.data);
    });

    it('returns SERVICE_UNAVAILABLE when the geocoder is down and nothing is stored', async () => {
      fail();

      const response = await searchZakopane();

      expect(response.body.errors[0].extensions.code).toBe('SERVICE_UNAVAILABLE');
    });

    it('treats a malformed geocoder response as a failure', async () => {
      testApp.openMeteo.respond('geocoding', loadFixture('search/geocoding-malformed.json'));

      const response = await searchZakopane();

      expect(response.body.errors[0].extensions.code).toBe('SERVICE_UNAVAILABLE');
    });

    it('does not cache a failed search', async () => {
      fail();
      await searchZakopane();
      scriptZakopane();

      const response = await searchZakopane();

      expect(response.body.errors).toBeUndefined();
      expect(response.body.data.searchLocations).toHaveLength(2);
    });
  });

  describe('input validation', () => {
    it.each([
      ['count 0', { name: 'Zakopane', count: 0 }],
      ['count 101', { name: 'Zakopane', count: 101 }],
      ['an empty name', { name: '', count: 5 }],
      ['a blank name', { name: '   ', count: 5 }],
      ['a name of 101 characters', { name: 'a'.repeat(101), count: 5 }],
      ['a 3-letter country code', { name: 'Zakopane', count: 5, countryCode: 'POL' }],
      ['a 1-letter country code', { name: 'Zakopane', count: 5, countryCode: 'P' }],
      ['a numeric country code', { name: 'Zakopane', count: 5, countryCode: '12' }],
      ['a 3-letter language', { name: 'Zakopane', count: 5, language: 'eng' }],
      ['an empty language', { name: 'Zakopane', count: 5, language: '' }],
    ])('rejects %s with BAD_USER_INPUT and makes no call', async (_label, variables) => {
      scriptZakopane();

      const response = await search(variables);

      expect(response.body.errors[0].extensions.code).toBe('BAD_USER_INPUT');
      expect(testApp.openMeteo.calls).toHaveLength(0);
    });

    it('accepts a name of exactly 100 characters', async () => {
      testApp.openMeteo.respond('geocoding', loadFixture('search/geocoding-empty.json'));

      const response = await search({ name: 'a'.repeat(100), count: 5 });

      expect(response.body.errors).toBeUndefined();
    });
  });
});
