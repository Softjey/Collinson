import { Injectable } from '@nestjs/common';
import type { RatedScore } from '../entities/rated-score.js';
import { stepLookup, type Step } from './math.js';

/** Turns a score into the eight named categories every activity is reported in. */
@Injectable()
export class ScoreScale {
  private readonly bands: Step<Pick<RatedScore, 'categoryIndex' | 'category'>>[] = [
    { from: 0, value: { categoryIndex: 1, category: 'UNSUITABLE' } },
    { from: 0.1, value: { categoryIndex: 2, category: 'POOR' } },
    { from: 0.4, value: { categoryIndex: 3, category: 'MARGINAL' } },
    { from: 0.5, value: { categoryIndex: 4, category: 'ACCEPTABLE' } },
    { from: 0.6, value: { categoryIndex: 5, category: 'GOOD' } },
    { from: 0.7, value: { categoryIndex: 6, category: 'VERY_GOOD' } },
    { from: 0.8, value: { categoryIndex: 7, category: 'EXCELLENT' } },
    { from: 0.9, value: { categoryIndex: 8, category: 'IDEAL' } },
  ];

  /** Rounds to two decimals first, so 0.395 counts as 0.40 and lands in MARGINAL. */
  rate(rawScore: number): RatedScore {
    if (!(rawScore >= 0 && rawScore <= 1)) {
      throw new RangeError(`Score must be between 0 and 1, got ${rawScore}`);
    }
    const score = Math.round(rawScore * 100) / 100;
    return { score, ...stepLookup(this.bands, score) };
  }
}
