import { jest } from '@jest/globals';
import { retry } from '.././retry.js';

class TransientError extends Error {}

const isTransient = (error: unknown) => error instanceof TransientError;

describe('retry', () => {
  it('returns the result without retrying when the first attempt succeeds', async () => {
    const operation = jest.fn<() => Promise<string>>().mockResolvedValue('ok');

    await expect(retry(operation, { retries: 2, shouldRetry: isTransient })).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('retries a retryable error and returns the later success', async () => {
    const operation = jest
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new TransientError())
      .mockResolvedValueOnce('ok');

    await expect(retry(operation, { retries: 1, shouldRetry: isTransient })).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('throws the last error after the retries are used up', async () => {
    const last = new TransientError('last');
    const operation = jest
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new TransientError('first'))
      .mockRejectedValueOnce(last);

    await expect(retry(operation, { retries: 1, shouldRetry: isTransient })).rejects.toBe(last);
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('does not retry an error the predicate rejects', async () => {
    const operation = jest.fn<() => Promise<string>>().mockRejectedValue(new Error('fatal'));

    await expect(retry(operation, { retries: 3, shouldRetry: isTransient })).rejects.toThrow('fatal');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('makes a single attempt when retries is 0', async () => {
    const operation = jest.fn<() => Promise<string>>().mockRejectedValue(new TransientError());

    await expect(retry(operation, { retries: 0, shouldRetry: isTransient })).rejects.toBeInstanceOf(
      TransientError,
    );
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('makes retries + 1 attempts in total', async () => {
    const operation = jest.fn<() => Promise<string>>().mockRejectedValue(new TransientError());

    await expect(retry(operation, { retries: 3, shouldRetry: isTransient })).rejects.toBeInstanceOf(
      TransientError,
    );
    expect(operation).toHaveBeenCalledTimes(4);
  });
});
