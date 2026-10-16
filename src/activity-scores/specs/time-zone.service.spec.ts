import { TimeZoneService } from '../time-zone.service.js';

describe('TimeZoneService', () => {
  const timeZoneService = new TimeZoneService();

  it.each([
    ['Barcelona', 41.39, 2.17, 'Europe/Madrid'],
    ['Auckland', -36.85, 174.76, 'Pacific/Auckland'],
    ['Honolulu', 21.31, -157.86, 'Pacific/Honolulu'],
    ['Zakopane', 49.3, 19.95, 'Europe/Warsaw'],
  ])('finds the IANA zone of %s', (_name, latitude, longitude, expected) => {
    expect(timeZoneService.timeZoneOf(latitude, longitude)).toBe(expected);
  });

  it('answers for both poles and both ends of the date line', () => {
    for (const [latitude, longitude] of [
      [90, 0],
      [-90, 0],
      [0, 180],
      [0, -180],
    ]) {
      expect(timeZoneService.timeZoneOf(latitude, longitude)).toEqual(expect.any(String));
    }
  });
});
