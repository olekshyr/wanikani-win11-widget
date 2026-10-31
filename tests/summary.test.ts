import { expect, test } from 'vitest';
import { countAvailableReviews } from '../src/core/summary';
import type { ReviewBucket, SummaryResponse } from '../src/core/types';

const s = (reviews: ReviewBucket[]): SummaryResponse => ({ data: { reviews, next_reviews_at: null } });
const now = new Date('2026-10-31T14:20:00Z');

test('sums subject_ids of all past-due buckets', () => {
  expect(countAvailableReviews(s([
    { available_at: '2026-10-31T13:00:00.000000Z', subject_ids: [1, 2] },
    { available_at: '2026-10-31T14:00:00.000000Z', subject_ids: [3] },
    { available_at: '2026-10-31T15:00:00.000000Z', subject_ids: [4, 5, 6] },
  ]), now)).toBe(3);
});

test('counts a bucket whose available_at equals now', () => {
  expect(countAvailableReviews(s([{ available_at: '2026-10-31T14:00:00.000000Z', subject_ids: [7, 8] }]),
    new Date('2026-10-31T14:00:00Z'))).toBe(2);
});

test('returns 0 for an empty reviews array', () => {
  expect(countAvailableReviews(s([]), now)).toBe(0);
});

test('returns 0 when only future buckets exist', () => {
  expect(countAvailableReviews(s([{ available_at: '2026-10-31T15:00:00Z', subject_ids: [1] }]), now)).toBe(0);
});
