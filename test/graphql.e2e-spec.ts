import { readFileSync } from 'node:fs';
import { jest } from '@jest/globals';
import { GraphQLSchemaHost } from '@nestjs/graphql';
import { buildSchema, parse, print, printSchema, visit } from 'graphql';
import request from 'supertest';
import { PlaceRepository } from '../src/search/place.repository.js';
import { createTestApp, type TestApp } from './support/app.js';

const contract = readFileSync(new URL('../contracts/graphql/schema.graphql', import.meta.url), 'utf8');

function withoutDescriptions(sdl: string): string {
  return print(
    visit(parse(sdl), {
      enter: (node) => ('description' in node ? { ...node, description: undefined } : undefined),
    }),
  );
}

const ACTIVITY_SCORES = `
  query ($input: ActivityScoresInput!) {
    activityScores(input: $input) { location { latitude } }
  }`;

const SEARCH = `
  query ($name: String!, $count: Int) {
    searchLocations(name: $name, count: $count) { id name }
  }`;

describe('GraphQL API', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  const post = (query: string, variables: Record<string, unknown>) =>
    request(testApp.app.getHttpServer()).post('/graphql').send({ query, variables });

  const validInput = {
    latitude: 41.85,
    longitude: 12.5,
    fromDate: '2026-10-13',
    toDate: '2026-10-15',
    activities: ['SKIING'],
  };

  it('serves the schema of the contract file', () => {
    const { schema } = testApp.app.get(GraphQLSchemaHost);

    expect(withoutDescriptions(printSchema(schema))).toBe(
      withoutDescriptions(printSchema(buildSchema(contract))),
    );
  });

  it('has a resolver for every Query field of the contract', () => {
    const { schema } = testApp.app.get(GraphQLSchemaHost);
    const fields = Object.values(schema.getQueryType()!.getFields());

    expect(fields.length).toBeGreaterThan(0);
    for (const field of fields) {
      expect({ field: field.name, hasResolver: typeof field.resolve === 'function' }).toEqual({
        field: field.name,
        hasResolver: true,
      });
    }
  });

  describe('input validation', () => {
    it.each([
      ['latitude above 90', { ...validInput, latitude: 90.5 }],
      ['latitude below -90', { ...validInput, latitude: -91 }],
      ['longitude above 180', { ...validInput, longitude: 181 }],
      ['longitude below -180', { ...validInput, longitude: -180.5 }],
      ['an empty activities list', { ...validInput, activities: [] }],
    ])('rejects %s with BAD_USER_INPUT', async (_label, input) => {
      const response = await post(ACTIVITY_SCORES, { input });

      expect(response.body.errors[0].extensions.code).toBe('BAD_USER_INPUT');
    });

    it.each([
      ['an impossible date', { ...validInput, fromDate: '2026-02-30' }],
      ['a datetime instead of a date', { ...validInput, toDate: '2026-10-15T00:00:00Z' }],
      ['an unknown activity', { ...validInput, activities: ['CURLING'] }],
    ])('rejects %s with BAD_USER_INPUT', async (_label, input) => {
      const response = await post(ACTIVITY_SCORES, { input });

      expect(response.body.errors[0].extensions.code).toBe('BAD_USER_INPUT');
    });

    it.each([0, 101, -1])('rejects a place search count of %s', async (count) => {
      const response = await post(SEARCH, { name: 'Rome', count });

      expect(response.body.errors[0].extensions.code).toBe('BAD_USER_INPUT');
    });

    it('rejects a place search without a name', async () => {
      const response = await post(SEARCH, { name: '', count: 5 });

      expect(response.body.errors[0].extensions.code).toBe('BAD_USER_INPUT');
    });

    it('accepts valid input and reaches the resolver', async () => {
      const response = await post(ACTIVITY_SCORES, { input: validInput });

      expect(response.body.errors[0].extensions.code).not.toBe('BAD_USER_INPUT');
    });
  });

  describe('error formatting', () => {
    it('hides the internals of an unexpected error', async () => {
      const failure = jest
        .spyOn(testApp.app.get(PlaceRepository), 'findSearch')
        .mockRejectedValueOnce(new Error('connection string with secret'));

      const response = await post(SEARCH, { name: 'Rome', count: 5 });

      failure.mockRestore();
      expect(response.body.errors[0].message).toBe('Internal server error');
      expect(response.body.errors[0].extensions).toEqual({ code: 'INTERNAL_SERVER_ERROR' });
    });

    it('never calls Open-Meteo for a request that failed validation', async () => {
      await post(SEARCH, { name: 'Rome', count: 0 });

      expect(testApp.openMeteo.calls).toHaveLength(0);
    });
  });
});
