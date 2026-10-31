import type { TileState, TileView } from './types';

type Face = Omit<TileView, 'unlocked'>;

function countFace(count: number, dimmed: boolean): Face {
  return {
    main: String(count),
    sub: count === 1 ? 'review' : 'reviews',
    tone: count > 0 ? 'blue' : 'grey',
    dimmed,
    offlineIcon: false,
  };
}

function face(state: TileState): Face {
  const plain = { dimmed: false, offlineIcon: false };
  switch (state.kind) {
    case 'setup': return { main: 'Set up', sub: 'WaniKani', tone: 'grey', ...plain };
    case 'loading': return { main: '…', sub: 'reviews', tone: 'blue', ...plain };
    case 'reviews': return countFace(state.count, false);
    case 'done': return countFace(0, false);
    case 'offline': return { main: 'Offline', sub: '', tone: 'dark', dimmed: false, offlineIcon: true };
    case 'token-invalid': return { main: 'Token', sub: 'invalid', tone: 'grey', ...plain };
    case 'api-error':
      return state.lastCount === null
        ? { main: '…', sub: 'reviews', tone: 'blue', dimmed: true, offlineIcon: false }
        : countFace(state.lastCount, true);
  }
}

export function tileView(state: TileState, locked: boolean): TileView {
  return { ...face(state), unlocked: !locked };
}
