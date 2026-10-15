import { buildLocationRef } from '../../../test/support/builders/weather.js';
import { loadFixture } from '../../../test/support/fixtures.js';
import {
  itPassesOpenMeteoFailuresThrough,
  openMeteoReturning,
} from '../../../test/support/open-meteo-stub.js';
import { MarineClient } from '../marine.client.js';

const location = buildLocationRef({ latE2: 4138, lonE2: 221 });

describe('MarineClient', () => {
  it('requests the point with its coordinates in degrees and its time zone', async () => {
    const marineResponse = loadFixture('weather/marine-barcelona.json');
    const { service, calls } = openMeteoReturning('marine', marineResponse);

    await expect(new MarineClient(service).fetch(location)).resolves.toBe(marineResponse);

    expect(calls).toEqual([{ latitude: 41.38, longitude: 2.21, timezone: 'Europe/Madrid' }]);
  });

  describe('HTTP client errors', () => {
    itPassesOpenMeteoFailuresThrough('marine', (service) => new MarineClient(service).fetch(location));
  });
});
