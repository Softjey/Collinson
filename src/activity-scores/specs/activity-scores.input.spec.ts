import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ActivityScoresInput } from '../entities/activity-scores.input.js';

const validInput = {
  latitude: 41.39,
  longitude: 2.17,
  fromDate: '2026-10-13',
  toDate: '2026-10-20',
  activities: ['SKIING', 'SURFING'],
};

async function validationErrorsFor(overrides: Record<string, unknown>) {
  const input = plainToInstance(ActivityScoresInput, { ...validInput, ...overrides });
  return { input, errors: await validate(input) };
}

describe('ActivityScoresInput', () => {
  it('accepts a valid input', async () => {
    expect((await validationErrorsFor({})).errors).toHaveLength(0);
  });

  it.each([90, -90, 0])('accepts latitude %s', async (latitude) => {
    expect((await validationErrorsFor({ latitude })).errors).toHaveLength(0);
  });

  it.each([90.01, -90.01])('rejects latitude %s', async (latitude) => {
    expect((await validationErrorsFor({ latitude })).errors).toHaveLength(1);
  });

  it.each([180, -180, 0])('accepts longitude %s', async (longitude) => {
    expect((await validationErrorsFor({ longitude })).errors).toHaveLength(0);
  });

  it.each([180.01, -180.01])('rejects longitude %s', async (longitude) => {
    expect((await validationErrorsFor({ longitude })).errors).toHaveLength(1);
  });

  it.each([
    [41.3851, -0.1278, 41.39, -0.13],
    [89.999, 179.999, 90, 180],
    [-0.001, -0.004, 0, 0],
  ])('rounds %s, %s to %s, %s', async (latitude, longitude, roundedLatitude, roundedLongitude) => {
    const { input, errors } = await validationErrorsFor({ latitude, longitude });

    expect(errors).toHaveLength(0);
    expect(Object.is(input.latitude, roundedLatitude)).toBe(true);
    expect(Object.is(input.longitude, roundedLongitude)).toBe(true);
  });

  it('rejects an empty activity list', async () => {
    expect((await validationErrorsFor({ activities: [] })).errors).toHaveLength(1);
  });

  it('rejects an unknown activity', async () => {
    expect((await validationErrorsFor({ activities: ['CURLING'] })).errors).toHaveLength(1);
  });

  it('collapses duplicate activities and keeps the first order', async () => {
    const { input, errors } = await validationErrorsFor({ activities: ['SURFING', 'SKIING', 'SURFING'] });

    expect(errors).toHaveLength(0);
    expect(input.activities).toEqual(['SURFING', 'SKIING']);
  });
});
