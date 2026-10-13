export class OpenMeteoRateLimitedError extends Error {
  constructor() {
    super('Open-Meteo rate limit reached');
    this.name = 'OpenMeteoRateLimitedError';
  }
}

export class OpenMeteoBadRequestError extends Error {
  constructor(readonly reason: string) {
    super(`Open-Meteo rejected the request: ${reason}`);
    this.name = 'OpenMeteoBadRequestError';
  }
}

export class OpenMeteoUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'OpenMeteoUnavailableError';
  }
}
