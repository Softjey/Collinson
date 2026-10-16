export class SingleFlight {
  private readonly inFlight = new Map<string, Promise<unknown>>();

  isRunning(key: string): boolean {
    return this.inFlight.has(key);
  }

  run<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(key);
    if (existing) {
      return existing as Promise<T>;
    }
    const flight = operation().finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, flight);
    return flight;
  }
}
