import { Test } from '@nestjs/testing';
import { ACTIVITIES } from './activity.js';
import { ScorerRegistry } from './scorer.registry.js';
import { ScoringModule } from './scoring.module.js';

describe('ScoringModule', () => {
  it('registers a scorer for every activity', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ScoringModule] }).compile();
    const registry = moduleRef.get(ScorerRegistry);

    for (const activity of ACTIVITIES) {
      expect(registry.get(activity).activity).toBe(activity);
    }
  });
});
