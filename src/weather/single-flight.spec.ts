import { jest } from '@jest/globals';
import { SingleFlight } from './single-flight.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('SingleFlight', () => {
  it('runs the operation once for concurrent calls with the same key', async () => {
    const flights = new SingleFlight();
    const gate = deferred<string>();
    const operation = jest.fn(() => gate.promise);

    const first = flights.run('forecast:1', operation);
    const second = flights.run('forecast:1', operation);
    gate.resolve('data');

    await expect(Promise.all([first, second])).resolves.toEqual(['data', 'data']);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('does not share a flight between different keys', async () => {
    const flights = new SingleFlight();
    const operation = jest.fn(async () => 'data');

    await Promise.all([flights.run('forecast:1', operation), flights.run('marine:1', operation)]);

    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('starts a new flight after the previous one succeeded', async () => {
    const flights = new SingleFlight();
    const operation = jest.fn(async () => 'data');

    await flights.run('forecast:1', operation);
    await flights.run('forecast:1', operation);

    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('rejects all waiters of a failed flight and does not keep it', async () => {
    const flights = new SingleFlight();
    const gate = deferred<string>();
    const failing = jest.fn(() => gate.promise);
    const error = new Error('down');

    const first = flights.run('forecast:1', failing);
    const second = flights.run('forecast:1', failing);
    gate.reject(error);

    await expect(first).rejects.toBe(error);
    await expect(second).rejects.toBe(error);
    expect(failing).toHaveBeenCalledTimes(1);

    const retry = jest.fn(async () => 'data');
    await expect(flights.run('forecast:1', retry)).resolves.toBe('data');
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
