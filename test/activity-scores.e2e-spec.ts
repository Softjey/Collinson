import { ScoreScale } from '../src/scoring/utils/score-scale.js';
import {
  OpenMeteoRateLimitedError,
  OpenMeteoUnavailableError,
} from '../src/shared/open-meteo/open-meteo.errors.js';
import { graphqlRequest, useTestApp } from './support/app.js';
import { useTestDatabase } from './support/database.js';
import { DAY_MS, moveClockTo, restoreClock } from './support/fake-clock.js';
import { loadFixture, shiftHourlyTimes } from './support/fixtures.js';
import { ACTIVITY_SCORES } from './support/queries.js';

const HOUR_MS = 3_600_000;
const FETCH_TIME = Date.parse('2026-10-13T12:00:00Z');
const ALL_ACTIVITIES = ['SKIING', 'SURFING', 'OUTDOOR_SIGHTSEEING', 'INDOOR_SIGHTSEEING'];

const BARCELONA = { latitude: 41.3851, longitude: 2.1734 };
const MADRID = { latitude: 40.4168, longitude: -3.7038 };

const barcelonaForecast = loadFixture<{ hourly: { time: number[] } }>('weather/forecast-barcelona.json');
const barcelonaMarine = loadFixture('weather/marine-barcelona.json');
const inlandMarine = loadFixture('weather/marine-madrid-inland.json');

describe('activityScores', () => {
  const testApp = useTestApp();
  useTestDatabase();

  beforeEach(() => moveClockTo(FETCH_TIME));
  afterEach(restoreClock);

  const scriptCoast = () =>
    testApp.openMeteo.respond('forecast', barcelonaForecast).respond('marine', barcelonaMarine);

  const failWith = (endpoint: 'forecast' | 'marine', error: Error) =>
    testApp.openMeteo.respond(endpoint, () => {
      throw error;
    });

  const scores = (overrides: Record<string, unknown> = {}) =>
    graphqlRequest(testApp, ACTIVITY_SCORES, {
      input: { ...BARCELONA, fromDate: '2026-10-13', toDate: '2026-10-20', ...overrides },
    });

  const upstreamCalls = (endpoint: 'forecast' | 'marine') =>
    testApp.openMeteo.calls.filter((call) => call.endpoint === endpoint);

  const activityResult = (response: Awaited<ReturnType<typeof scores>>, activity: string) =>
    response.body.data.activityScores.activities.find(
      (result: { activity: string }) => result.activity === activity,
    );

  describe('with a coastal point', () => {
    it('scores all four activities for eight days with valid scores and categories', async () => {
      scriptCoast();

      const response = await scores({ activities: ALL_ACTIVITIES });

      expect(response.body.errors).toBeUndefined();
      const { location, activities } = response.body.data.activityScores;
      expect(location).toEqual({
        latitude: 41.39,
        longitude: 2.17,
        elevation: 12,
        timezone: 'Europe/Madrid',
      });
      expect(activities.map((result: { activity: string }) => result.activity)).toEqual(ALL_ACTIVITIES);

      const scoreScale = new ScoreScale();
      for (const result of activities) {
        expect(result.__typename).toBe('ActivityDayScores');
        expect(result.days.map((day: { date: string }) => day.date)).toEqual([
          '2026-10-13',
          '2026-10-14',
          '2026-10-15',
          '2026-10-16',
          '2026-10-17',
          '2026-10-18',
          '2026-10-19',
          '2026-10-20',
        ]);
        for (const day of result.days) {
          if (day.__typename === 'ScoredDay') {
            expect(day.score).toBeGreaterThanOrEqual(0);
            expect(day.score).toBeLessThanOrEqual(1);
            expect(day).toMatchObject(scoreScale.rate(day.score));
          } else {
            expect(['NO_SEA', 'NO_SNOW', 'NO_DATA']).toContain(day.reason);
          }
        }
      }
    });

    it('reports freshness only for the sources an activity needs', async () => {
      scriptCoast();

      const response = await scores({ activities: ['SKIING', 'SURFING'] });

      const fetchedAt = new Date(FETCH_TIME).toISOString();
      expect(activityResult(response, 'SKIING').freshness).toEqual([
        { kind: 'WEATHER', updatedAt: fetchedAt, stale: false },
      ]);
      expect(activityResult(response, 'SURFING').freshness).toEqual([
        { kind: 'WEATHER', updatedAt: fetchedAt, stale: false },
        { kind: 'WAVES', updatedAt: fetchedAt, stale: false },
      ]);
    });

    it('returns all four activities in the contract order by default', async () => {
      scriptCoast();

      const response = await graphqlRequest(testApp, ACTIVITY_SCORES, {
        input: { ...BARCELONA, fromDate: '2026-10-13', toDate: '2026-10-13' },
      });

      expect(
        response.body.data.activityScores.activities.map((result: { activity: string }) => result.activity),
      ).toEqual(ALL_ACTIVITIES);
    });

    it('returns one result for a repeated activity', async () => {
      scriptCoast();

      const response = await scores({ activities: ['SURFING', 'SKIING', 'SURFING'] });

      expect(
        response.body.data.activityScores.activities.map((result: { activity: string }) => result.activity),
      ).toEqual(['SURFING', 'SKIING']);
    });

    it('returns a single day for a single-day range', async () => {
      scriptCoast();

      const response = await scores({
        fromDate: '2026-10-15',
        toDate: '2026-10-15',
        activities: ['OUTDOOR_SIGHTSEEING'],
      });

      expect(activityResult(response, 'OUTDOOR_SIGHTSEEING').days).toHaveLength(1);
      expect(activityResult(response, 'OUTDOOR_SIGHTSEEING').days[0].date).toBe('2026-10-15');
    });

    it('makes no upstream call for a second request within the refresh interval', async () => {
      scriptCoast();
      await scores({ activities: ALL_ACTIVITIES });
      const callsAfterFirstRequest = testApp.openMeteo.calls.length;

      const second = await scores({ activities: ALL_ACTIVITIES });

      expect(second.body.errors).toBeUndefined();
      expect(testApp.openMeteo.calls).toHaveLength(callsAfterFirstRequest);
    });

    it('does not call the marine API when only skiing is requested', async () => {
      scriptCoast();

      const response = await scores({ activities: ['SKIING'] });

      expect(response.body.errors).toBeUndefined();
      expect(upstreamCalls('forecast')).toHaveLength(1);
      expect(upstreamCalls('marine')).toHaveLength(0);
    });
  });

  describe('with an inland point', () => {
    it('marks every surfing day NO_SEA and does not ask for waves again', async () => {
      testApp.openMeteo.respond('forecast', barcelonaForecast).respond('marine', inlandMarine);

      const first = await scores({ ...MADRID, activities: ['SURFING'] });
      const second = await scores({ ...MADRID, activities: ['SURFING'] });

      for (const response of [first, second]) {
        const days = activityResult(response, 'SURFING').days;
        expect(days).toHaveLength(8);
        expect(days.every((day: { reason: string }) => day.reason === 'NO_SEA')).toBe(true);
      }
      expect(upstreamCalls('marine')).toHaveLength(1);
    });
  });

  describe('when Open-Meteo fails and nothing is stored', () => {
    it('makes only surfing unavailable when marine is down', async () => {
      testApp.openMeteo.respond('forecast', barcelonaForecast);
      failWith('marine', new OpenMeteoUnavailableError('down'));

      const response = await scores({ activities: ALL_ACTIVITIES });

      expect(response.body.errors).toBeUndefined();
      expect(activityResult(response, 'SURFING')).toEqual({
        __typename: 'ActivityDataUnavailable',
        activity: 'SURFING',
        cause: 'TEMPORARILY_UNAVAILABLE',
      });
      for (const activity of ['SKIING', 'OUTDOOR_SIGHTSEEING', 'INDOOR_SIGHTSEEING']) {
        expect(activityResult(response, activity).__typename).toBe('ActivityDayScores');
      }
    });

    it('makes all four unavailable and returns no elevation when forecast is down', async () => {
      failWith('forecast', new OpenMeteoUnavailableError('down'));
      testApp.openMeteo.respond('marine', barcelonaMarine);

      const response = await scores({ activities: ALL_ACTIVITIES });

      expect(response.body.errors).toBeUndefined();
      const { location, activities } = response.body.data.activityScores;
      expect(location.elevation).toBeNull();
      expect(activities).toHaveLength(4);
      for (const result of activities) {
        expect(result).toMatchObject({
          __typename: 'ActivityDataUnavailable',
          cause: 'TEMPORARILY_UNAVAILABLE',
        });
      }
    });

    it('reports RATE_LIMITED when forecast answers 429', async () => {
      failWith('forecast', new OpenMeteoRateLimitedError());
      testApp.openMeteo.respond('marine', barcelonaMarine);

      const response = await scores({ activities: ALL_ACTIVITIES });

      for (const result of response.body.data.activityScores.activities) {
        expect(result).toMatchObject({ __typename: 'ActivityDataUnavailable', cause: 'RATE_LIMITED' });
      }
    });
  });

  describe('when Open-Meteo fails and an old snapshot is stored', () => {
    const storeSnapshotThenFailForecast = async (
      hoursLater: number,
      overrides: Record<string, unknown> = {},
    ) => {
      scriptCoast();
      await scores({ activities: ['SKIING', 'SURFING'], ...overrides });
      moveClockTo(FETCH_TIME + hoursLater * HOUR_MS);
      failWith('forecast', new OpenMeteoUnavailableError('down'));
    };

    it('serves a 10 hour old snapshot as stale with the original fetch time', async () => {
      await storeSnapshotThenFailForecast(10);

      const response = await scores({
        fromDate: '2026-10-14',
        activities: ['OUTDOOR_SIGHTSEEING', 'SURFING'],
      });

      expect(activityResult(response, 'OUTDOOR_SIGHTSEEING')).toMatchObject({
        __typename: 'ActivityDayScores',
        freshness: [{ kind: 'WEATHER', updatedAt: new Date(FETCH_TIME).toISOString(), stale: true }],
      });
      expect(activityResult(response, 'SURFING').freshness).toEqual([
        { kind: 'WEATHER', updatedAt: new Date(FETCH_TIME).toISOString(), stale: true },
        { kind: 'WAVES', updatedAt: new Date(FETCH_TIME).toISOString(), stale: false },
      ]);
    });

    it('reports a 50 hour old snapshot as too old with its fetch time', async () => {
      await storeSnapshotThenFailForecast(50);

      const response = await scores({ fromDate: '2026-10-15', toDate: '2026-10-16', activities: ['SKIING'] });

      expect(activityResult(response, 'SKIING')).toEqual({
        __typename: 'ActivityDataTooOld',
        activity: 'SKIING',
        lastUpdatedAt: new Date(FETCH_TIME).toISOString(),
      });
    });

    it('leaves the day the snapshot does not reach as NO_DATA and scores the others', async () => {
      scriptCoast();
      await scores({ activities: ['OUTDOOR_SIGHTSEEING'] });
      moveClockTo(FETCH_TIME + DAY_MS);
      failWith('forecast', new OpenMeteoUnavailableError('down'));

      const response = await scores({
        fromDate: '2026-10-14',
        toDate: '2026-10-21',
        activities: ['OUTDOOR_SIGHTSEEING'],
      });

      const days = activityResult(response, 'OUTDOOR_SIGHTSEEING').days;
      expect(days).toHaveLength(8);
      expect(days[7]).toEqual({ __typename: 'UnscoredDay', date: '2026-10-21', reason: 'NO_DATA' });
      expect(days.slice(0, 7).every((day: { __typename: string }) => day.__typename === 'ScoredDay')).toBe(
        true,
      );
    });
  });

  it('refetches a fresh snapshot taken before local midnight when the range now reaches past it', async () => {
    testApp.openMeteo.respond('forecast', barcelonaForecast);
    moveClockTo(Date.parse('2026-10-13T21:30:00Z'));
    await scores({ activities: ['OUTDOOR_SIGHTSEEING'] });
    moveClockTo(Date.parse('2026-10-13T22:30:00Z'));
    testApp.openMeteo.respond('forecast', shiftHourlyTimes(barcelonaForecast, 1));

    const response = await scores({
      fromDate: '2026-10-14',
      toDate: '2026-10-21',
      activities: ['OUTDOOR_SIGHTSEEING'],
    });

    expect(upstreamCalls('forecast')).toHaveLength(2);
    const days = activityResult(response, 'OUTDOOR_SIGHTSEEING').days;
    expect(days).toHaveLength(8);
    expect(days.every((day: { __typename: string }) => day.__typename === 'ScoredDay')).toBe(true);
  });

  describe('metrics', () => {
    const resultCount = (status: string, activity?: string) =>
      testApp.inMemoryMetrics.counterValue('activityResult', { status, ...(activity && { activity }) });

    it('counts each activity result by its kind', async () => {
      testApp.openMeteo.respond('forecast', barcelonaForecast);
      failWith('marine', new OpenMeteoUnavailableError('down'));
      const before = { scored: await resultCount('scored'), unavailable: await resultCount('unavailable') };

      await scores({ activities: ['SKIING', 'SURFING', 'INDOOR_SIGHTSEEING'] });

      expect((await resultCount('scored')) - before.scored).toBe(2);
      expect((await resultCount('unavailable')) - before.unavailable).toBe(1);
      expect(await resultCount('unavailable', 'SURFING')).toBeGreaterThanOrEqual(1);
    });

    it('counts unscored days by activity and reason', async () => {
      testApp.openMeteo.respond('forecast', barcelonaForecast).respond('marine', inlandMarine);
      const unscoredNoSea = () =>
        testApp.inMemoryMetrics.counterValue('unscoredDay', { activity: 'SURFING', reason: 'NO_SEA' });
      const before = await unscoredNoSea();

      await scores({ ...MADRID, activities: ['SURFING'] });

      expect((await unscoredNoSea()) - before).toBe(8);
    });

    it('counts no unscored day for an activity whose days are all scored', async () => {
      scriptCoast();
      const unscoredIndoor = () =>
        testApp.inMemoryMetrics.counterValue('unscoredDay', { activity: 'INDOOR_SIGHTSEEING' });
      const before = await unscoredIndoor();

      await scores({ activities: ['INDOOR_SIGHTSEEING'] });

      expect(await unscoredIndoor()).toBe(before);
    });
  });

  describe('validation', () => {
    it.each([
      ['fromDate after toDate', { fromDate: '2026-10-15', toDate: '2026-10-14' }],
      ['fromDate before today', { fromDate: '2026-10-12', toDate: '2026-10-14' }],
      ['toDate at today + 8', { fromDate: '2026-10-13', toDate: '2026-10-21' }],
      ['latitude above 90', { latitude: 90.01 }],
      ['longitude above 180', { longitude: 180.01 }],
      ['no activities', { activities: [] }],
      ['an impossible date', { fromDate: '2026-02-30' }],
    ])('rejects %s with BAD_USER_INPUT and calls no upstream', async (_label, overrides) => {
      scriptCoast();

      const response = await scores(overrides);

      expect(response.body.errors[0].extensions.code).toBe('BAD_USER_INPUT');
      expect(testApp.openMeteo.calls).toHaveLength(0);
    });

    it('takes "today" in the time zone of the location', async () => {
      scriptCoast();

      const inAuckland = await scores({
        latitude: -36.85,
        longitude: 174.76,
        fromDate: '2026-10-13',
        toDate: '2026-10-14',
      });
      const inHonolulu = await scores({
        latitude: 21.31,
        longitude: -157.86,
        fromDate: '2026-10-13',
        toDate: '2026-10-14',
      });

      expect(inAuckland.body.errors[0].extensions.code).toBe('BAD_USER_INPUT');
      expect(inHonolulu.body.errors).toBeUndefined();
    });
  });
});
