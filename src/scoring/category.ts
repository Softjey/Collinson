import { stepLookup } from './math.js';

export const CATEGORY_BANDS = [
  { from: 0, index: 1, category: 'UNSUITABLE' },
  { from: 0.1, index: 2, category: 'POOR' },
  { from: 0.4, index: 3, category: 'MARGINAL' },
  { from: 0.5, index: 4, category: 'ACCEPTABLE' },
  { from: 0.6, index: 5, category: 'GOOD' },
  { from: 0.7, index: 6, category: 'VERY_GOOD' },
  { from: 0.8, index: 7, category: 'EXCELLENT' },
  { from: 0.9, index: 8, category: 'IDEAL' },
] as const;

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
