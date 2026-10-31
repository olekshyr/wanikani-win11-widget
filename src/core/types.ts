export interface ReviewBucket {
  available_at: string;
  subject_ids: number[];
}

export interface SummaryResponse {
  data: { reviews: ReviewBucket[]; next_reviews_at: string | null };
}

export type FetchResult =
  | { kind: 'ok'; count: number }
  | { kind: 'unauthorized' }
  | { kind: 'offline' }
  | { kind: 'api-error' };
