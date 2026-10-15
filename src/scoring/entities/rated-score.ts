export type ScoreCategory =
  'UNSUITABLE' | 'POOR' | 'MARGINAL' | 'ACCEPTABLE' | 'GOOD' | 'VERY_GOOD' | 'EXCELLENT' | 'IDEAL';

export interface RatedScore {
  score: number;
  categoryIndex: number;
  category: ScoreCategory;
}
