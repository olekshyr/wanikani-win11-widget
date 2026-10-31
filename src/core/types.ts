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

export type TileState =
  | { kind: 'setup' }
  | { kind: 'loading' }
  | { kind: 'reviews'; count: number }
  | { kind: 'done' }
  | { kind: 'offline' }
  | { kind: 'token-invalid' }
  | { kind: 'api-error'; lastCount: number | null };

export interface TileView {
  main: string;
  sub: string;
  tone: 'blue' | 'grey' | 'dark';
  dimmed: boolean;
  offlineIcon: boolean;
  unlocked: boolean;
}

export type ClickAction = 'open-dashboard' | 'open-token-window' | 'none';
