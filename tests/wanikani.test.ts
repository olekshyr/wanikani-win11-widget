import { expect, test } from 'vitest';
import { fetchReviewCount, normalizeToken } from '../src/core/wanikani';

const now = () => new Date('2026-10-31T14:20:00Z');
const body = {
  data: {
    next_reviews_at: '2026-10-31T14:00:00Z',
    reviews: [
      { available_at: '2026-10-31T14:00:00.000000Z', subject_ids: [1, 2] },
      { available_at: '2026-10-31T15:00:00.000000Z', subject_ids: [3] },
    ],
  },
};

function fakeFetch(respond: () => Response | Promise<Response>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return respond();
  }) as unknown as typeof fetch;
  return { fn, calls };
}

const json = (status: number, b: unknown) => () => new Response(JSON.stringify(b), { status });

test('sends bearer token and revision header to /v2/summary', async () => {
  const f = fakeFetch(json(200, body));
  await fetchReviewCount('abc', { fetch: f.fn, now });
  expect(f.calls[0].url).toBe('https://api.wanikani.com/v2/summary');
  const h = new Headers(f.calls[0].init?.headers);
  expect(h.get('Authorization')).toBe('Bearer abc');
  expect(h.get('Wanikani-Revision')).toBe('20170710');
});

test('200 with valid body → ok with count', async () => {
  expect(await fetchReviewCount('abc', { fetch: fakeFetch(json(200, body)).fn, now })).toEqual({ kind: 'ok', count: 2 });
});

test('401 → unauthorized', async () => {
  expect(await fetchReviewCount('abc', { fetch: fakeFetch(json(401, { error: 'Unauthorized' })).fn, now }))
    .toEqual({ kind: 'unauthorized' });
});

test('500 → api-error', async () => {
  expect(await fetchReviewCount('abc', { fetch: fakeFetch(json(500, {})).fn, now })).toEqual({ kind: 'api-error' });
});

test('429 → api-error', async () => {
  expect(await fetchReviewCount('abc', { fetch: fakeFetch(json(429, {})).fn, now })).toEqual({ kind: 'api-error' });
});

test('200 with non-JSON body → api-error', async () => {
  const f = fakeFetch(() => new Response('<html>oops</html>', { status: 200 }));
  expect(await fetchReviewCount('abc', { fetch: f.fn, now })).toEqual({ kind: 'api-error' });
});

test('200 with JSON missing data.reviews → api-error', async () => {
  expect(await fetchReviewCount('abc', { fetch: fakeFetch(json(200, { data: {} })).fn, now }))
    .toEqual({ kind: 'api-error' });
});

test('fetch throws TypeError("fetch failed") → offline', async () => {
  const f = fakeFetch(() => { throw new TypeError('fetch failed'); });
  expect(await fetchReviewCount('abc', { fetch: f.fn, now })).toEqual({ kind: 'offline' });
});

test('fetch throws TimeoutError → offline', async () => {
  const f = fakeFetch(() => { throw new DOMException('timed out', 'TimeoutError'); });
  expect(await fetchReviewCount('abc', { fetch: f.fn, now })).toEqual({ kind: 'offline' });
});

test('normalizeToken trims spaces and newlines', () => {
  expect(normalizeToken('  abc-123\r\n')).toBe('abc-123');
});
