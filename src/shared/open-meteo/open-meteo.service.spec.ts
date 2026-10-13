import { jest } from '@jest/globals';
import { OpenMeteoService } from './open-meteo.service.js';

function createService() {
  const clients = {
    forecast: { get: jest.fn<(p: object) => Promise<unknown>>().mockResolvedValue('forecast-body') },
    marine: { get: jest.fn<(p: object) => Promise<unknown>>().mockResolvedValue('marine-body') },
    geocoding: { get: jest.fn<(p: object) => Promise<unknown>>().mockResolvedValue('geocoding-body') },
  };
  return { clients, service: new OpenMeteoService(clients) };
}

describe('OpenMeteoService', () => {
  it('sends forecast requests only to the forecast endpoint', async () => {
    const { clients, service } = createService();

    await expect(service.forecast({ latitude: 1 })).resolves.toBe('forecast-body');

    expect(clients.forecast.get).toHaveBeenCalledWith({ latitude: 1 });
    expect(clients.marine.get).not.toHaveBeenCalled();
    expect(clients.geocoding.get).not.toHaveBeenCalled();
  });

  it('sends marine requests only to the marine endpoint', async () => {
    const { clients, service } = createService();

    await expect(service.marine({ latitude: 2 })).resolves.toBe('marine-body');

    expect(clients.marine.get).toHaveBeenCalledWith({ latitude: 2 });
    expect(clients.forecast.get).not.toHaveBeenCalled();
  });

  it('sends geocoding requests only to the geocoding endpoint', async () => {
    const { clients, service } = createService();

    await expect(service.geocoding({ name: 'Rome' })).resolves.toBe('geocoding-body');

    expect(clients.geocoding.get).toHaveBeenCalledWith({ name: 'Rome' });
    expect(clients.forecast.get).not.toHaveBeenCalled();
  });

  it('passes errors through unchanged', async () => {
    const { clients, service } = createService();
    const failure = new Error('down');
    clients.forecast.get.mockRejectedValue(failure);

    await expect(service.forecast({})).rejects.toBe(failure);
  });
});
