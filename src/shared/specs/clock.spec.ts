import { Test } from '@nestjs/testing';
import { Clock, SystemClock } from '../clock.js';
import { ClockModule } from '../clock.module.js';

describe('SystemClock', () => {
  it('returns the current time', () => {
    const before = Date.now();
    const now = new SystemClock().now().getTime();

    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
  });
});

describe('ClockModule', () => {
  it('provides a SystemClock under the Clock token', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ClockModule] }).compile();

    expect(moduleRef.get(Clock)).toBeInstanceOf(SystemClock);
  });

  it('does not provide anything else', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ClockModule] }).compile();

    expect(() => moduleRef.get('Other')).toThrow();
  });
});
