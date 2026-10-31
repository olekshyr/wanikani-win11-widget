import type { SummaryResponse } from './types';

export function countAvailableReviews(summary: SummaryResponse, now: Date): number {
  return summary.data.reviews
    .filter((b) => Date.parse(b.available_at) <= now.getTime())
    .reduce((sum, b) => sum + b.subject_ids.length, 0);
}
