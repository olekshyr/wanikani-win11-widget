import { countAvailableReviews } from './summary';
import type { FetchResult, SummaryResponse } from './types';

export const DASHBOARD_URL = 'https://www.wanikani.com/dashboard';
export const TOKEN_SETTINGS_URL = 'https://www.wanikani.com/settings/personal_access_tokens';

const SUMMARY_URL = 'https://api.wanikani.com/v2/summary';
const TIMEOUT_MS = 15000;

export function normalizeToken(input: string): string {
  return input.trim();
}

export async function fetchReviewCount(
  token: string,
  deps: { fetch?: typeof fetch; now?: () => Date } = {},
): Promise<FetchResult> {
  const doFetch = deps.fetch ?? fetch;
  const now = deps.now ?? (() => new Date());

  let res: Response;
  try {
    res = await doFetch(SUMMARY_URL, {
      headers: { Authorization: `Bearer ${token}`, 'Wanikani-Revision': '20170710' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return { kind: 'offline' };
  }

  if (res.status === 401) return { kind: 'unauthorized' };
  if (!res.ok) return { kind: 'api-error' };

  try {
    const body = (await res.json()) as SummaryResponse;
    if (!Array.isArray(body?.data?.reviews)) return { kind: 'api-error' };
    return { kind: 'ok', count: countAvailableReviews(body, now()) };
  } catch {
    return { kind: 'api-error' };
  }
}
