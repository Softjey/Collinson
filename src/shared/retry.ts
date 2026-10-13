export interface RetryOptions {
  retries: number;
  shouldRetry: (error: unknown) => boolean;
}

export async function retry<T>(operation: () => Promise<T>, options: RetryOptions): Promise<T> {
  for (let attemptsLeft = options.retries; ; attemptsLeft--) {
    try {
      return await operation();
    } catch (error) {
      if (attemptsLeft <= 0 || !options.shouldRetry(error)) {
        throw error;
      }
    }
  }
}
