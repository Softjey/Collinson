import { stepLookup } from './math.js';
import { CATEGORY_BANDS } from './scoring.params.js';

export type ScoreCategory = (typeof CATEGORY_BANDS)[number]['category'];

export interface CategorizedScore {
  score: number;
  index: number;
  category: ScoreCategory;
}

export function categorize(rawScore: number): CategorizedScore {
  if (!(rawScore >= 0 && rawScore <= 1)) {
    throw new RangeError(`Score must be between 0 and 1, got ${rawScore}`);
  }
  const score = Math.round(rawScore * 100) / 100;
  const { index, category } = stepLookup(
    CATEGORY_BANDS.map(({ from, index, category }) => ({ from, value: { index, category } })),
    score,
  );
  return { score, index, category };
}
