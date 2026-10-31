import type { ClickAction, FetchResult, TileState } from './types';

function lastKnownCount(prev: TileState): number | null {
  switch (prev.kind) {
    case 'reviews': return prev.count;
    case 'done': return 0;
    case 'api-error': return prev.lastCount;
    default: return null;
  }
}

export function nextTileState(prev: TileState, result: FetchResult): TileState {
  switch (result.kind) {
    case 'ok': return result.count > 0 ? { kind: 'reviews', count: result.count } : { kind: 'done' };
    case 'unauthorized': return { kind: 'token-invalid' };
    case 'offline': return { kind: 'offline' };
    case 'api-error': return { kind: 'api-error', lastCount: lastKnownCount(prev) };
  }
}

export function clickAction(state: TileState, locked: boolean): ClickAction {
  if (!locked) return 'none';
  switch (state.kind) {
    case 'reviews':
    case 'done':
    case 'offline':
    case 'api-error':
      return 'open-dashboard';
    case 'setup':
    case 'token-invalid':
      return 'open-token-window';
    case 'loading':
      return 'none';
  }
}
