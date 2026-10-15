import { buildLocationRef } from '../../../test/support/builders/weather.js';
import { loadFixture } from '../../../test/support/fixtures.js';
import {
  itPassesOpenMeteoFailuresThrough,
  openMeteoReturning,
} from '../../../test/support/open-meteo-stub.js';
import { ForecastClient } from '../forecast.client.js';

const location = buildLocationRef();

describe('ForecastClient', () => {
  it('requests the point with its coordinates in degrees and its time zone', async () => {
    const forecastResponse = loadFixture('weather/forecast-barcelona.json');
    const { service, calls } = openMeteoReturning('forecast', forecastResponse);

    await expect(new ForecastClient(service).fetch(location)).resolves.toBe(forecastResponse);

    expect(calls).toEqual([{ latitude: 41.4, longitude: 2.18, timezone: 'Europe/Madrid' }]);
  });

  describe('HTTP client errors', () => {
    itPassesOpenMeteoFailuresThrough('forecast', (service) => new ForecastClient(service).fetch(location));
  });
});
