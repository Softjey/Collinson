import {
  OpenMeteoBadRequestError,
  OpenMeteoRateLimitedError,
  OpenMeteoUnavailableError,
} from '../../src/shared/open-meteo/open-meteo.errors.js';
import type { OpenMeteoService } from '../../src/shared/open-meteo/open-meteo.service.js';

type WeatherEndpoint = 'forecast' | 'marine';

export const OPEN_METEO_FAILURES = [
  ['rate limited', new OpenMeteoRateLimitedError()],
  ['bad request', new OpenMeteoBadRequestError('bad')],
  ['unavailable', new OpenMeteoUnavailableError('down')],
] as const;

/** An OpenMeteoService whose one endpoint answers with `response` and records the requests it receives. */
export function openMeteoReturning(endpoint: WeatherEndpoint, response: unknown) {
  const calls: unknown[] = [];
  const service = {
    [endpoint]: async (request: unknown) => {
      calls.push(request);
      return response;
    },
  } as unknown as OpenMeteoService;
  return { service, calls };
}

export function openMeteoFailing(endpoint: WeatherEndpoint, error: Error): OpenMeteoService {
  return {
    [endpoint]: async () => {
      throw error;
    },
  } as unknown as OpenMeteoService;
}

/** Registers the error pass-through cases every Open-Meteo client must satisfy. */
export function itPassesOpenMeteoFailuresThrough(
  endpoint: WeatherEndpoint,
  fetchWith: (service: OpenMeteoService) => Promise<unknown>,
): void {
  it.each(OPEN_METEO_FAILURES)('passes a %s error through', async (_name, error) => {
    await expect(fetchWith(openMeteoFailing(endpoint, error))).rejects.toBe(error);
  });
}
