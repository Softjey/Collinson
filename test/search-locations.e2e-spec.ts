import { readFileSync } from 'node:fs';
import { jest } from '@jest/globals';
import request from 'supertest';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { OpenMeteoUnavailableError } from '../src/shared/open-meteo/open-meteo.errors.js';
import { createTestApp, type TestApp } from './support/app.js';
import { createTestPrisma, truncateAll } from './support/database.js';

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`./fixtures/search/${name}`, import.meta.url), 'utf8'));
}

const SEARCH = `
  query ($name: String!, $count: Int, $countryCode: String, $language: String) {
    searchLocations(name: $name, count: $count, countryCode: $countryCode, language: $language) {
      id name country countryCode admin1 latitude longitude elevation timezone population
    }
  }`;

const DAY_MS = 24 * 60 * 60 * 1000;

function moveClockTo(now: number): void {
  jest.useFakeTimers({
    now,
    doNotFake: [
      'hrtime',
      'nextTick',
      'performance',
      'queueMicrotask',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'requestIdleCallback',
      'cancelIdleCallback',
      'setImmediate',
      'clearImmediate',
      'setInterval',
      'clearInterval',
      'setTimeout',
      'clearTimeout',
    ],
  });
}

describe('searchLocations', () => {
  let testApp: TestApp;
  let prisma: PrismaClient;

  beforeAll(async () => {
    testApp = await createTestApp();
    prisma = createTestPrisma();
  });

  beforeEach(async () => {
    testApp.openMeteo.reset();
    await truncateAll(prisma);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await testApp.app.close();
  });

  const search = (variables: Record<string, unknown>) =>
    request(testApp.app.getHttpServer()).post('/graphql').send({ query: SEARCH, variables });

  const geocoderCalls = () => testApp.openMeteo.calls.filter((call) => call.endpoint === 'geocoding');

  const scriptZakopane = () => testApp.openMeteo.respond('geocoding', fixture('geocoding-zakopane.json'));

  it('calls the geocoder once and returns the places in order', async () => {
    scriptZakopane();

    const response = await search({ name: 'Zakopane', count: 2 });

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
    const first = await search({ name: 'Zakopane', count: 2 });

    const second = await search({ name: 'Zakopane', count: 2 });

    expect(geocoderCalls()).toHaveLength(1);
    expect(second.body.data).toEqual(first.body.data);
  });

  it.each(['zakopane', '  Zakopane ', 'ZAKOPANE'])('treats "%s" as the same search', async (name) => {
    scriptZakopane();
    await search({ name: 'Zakopane', count: 2 });

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
    await search({ name: 'Zakopane', count: 2 });

    await search(variables);

    expect(geocoderCalls()).toHaveLength(2);
  });

  it('returns an empty result as [] and caches it', async () => {
    testApp.openMeteo.respond('geocoding', fixture('geocoding-empty.json'));

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
      await search({ name: 'Zakopane', count: 2 });
      testApp.openMeteo.respond('geocoding', {
        results: [{ id: 99, name: 'Zakopane Nowe', latitude: 1, longitude: 2 }],
      });

      moveClockTo(start + 31 * DAY_MS);
      const response = await search({ name: 'Zakopane', count: 2 });

      expect(geocoderCalls()).toHaveLength(2);
      expect(response.body.data.searchLocations.map((place: { id: string }) => place.id)).toEqual(['99']);
    });

    it('still serves a search that is 29 days old', async () => {
      const start = Date.now();
      scriptZakopane();
      await search({ name: 'Zakopane', count: 2 });

      moveClockTo(start + 29 * DAY_MS);
      await search({ name: 'Zakopane', count: 2 });

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
      const first = await search({ name: 'Zakopane', count: 2 });
      fail();

      moveClockTo(start + 90 * DAY_MS);
      const response = await search({ name: 'Zakopane', count: 2 });

      expect(geocoderCalls()).toHaveLength(2);
      expect(response.body.errors).toBeUndefined();
      expect(response.body.data).toEqual(first.body.data);
    });

    it('returns SERVICE_UNAVAILABLE when the geocoder is down and nothing is stored', async () => {
      fail();

      const response = await search({ name: 'Zakopane', count: 2 });

      expect(response.body.errors[0].extensions.code).toBe('SERVICE_UNAVAILABLE');
    });

    it('treats a malformed geocoder response as a failure', async () => {
      testApp.openMeteo.respond('geocoding', fixture('geocoding-malformed.json'));

      const response = await search({ name: 'Zakopane', count: 2 });

      expect(response.body.errors[0].extensions.code).toBe('SERVICE_UNAVAILABLE');
    });

    it('does not cache a failed search', async () => {
      fail();
      await search({ name: 'Zakopane', count: 2 });
      scriptZakopane();

      const response = await search({ name: 'Zakopane', count: 2 });

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
      testApp.openMeteo.respond('geocoding', fixture('geocoding-empty.json'));

      const response = await search({ name: 'a'.repeat(100), count: 5 });

      expect(response.body.errors).toBeUndefined();
    });
  });
});
