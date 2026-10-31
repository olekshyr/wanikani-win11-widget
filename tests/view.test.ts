import { expect, test } from 'vitest';
import { tileView } from '../src/core/view';
import type { TileState, TileView } from '../src/core/types';

const cases: [string, TileState, Omit<TileView, 'unlocked'>][] = [
  ['setup', { kind: 'setup' }, { main: 'Set up', sub: 'WaniKani', tone: 'grey', dimmed: false, offlineIcon: false }],
  ['loading', { kind: 'loading' }, { main: '…', sub: 'reviews', tone: 'blue', dimmed: false, offlineIcon: false }],
  ['reviews 42', { kind: 'reviews', count: 42 }, { main: '42', sub: 'reviews', tone: 'blue', dimmed: false, offlineIcon: false }],
  ['reviews 1', { kind: 'reviews', count: 1 }, { main: '1', sub: 'review', tone: 'blue', dimmed: false, offlineIcon: false }],
  ['done', { kind: 'done' }, { main: '0', sub: 'reviews', tone: 'grey', dimmed: false, offlineIcon: false }],
  ['offline', { kind: 'offline' }, { main: 'Offline', sub: '', tone: 'dark', dimmed: false, offlineIcon: true }],
  ['token-invalid', { kind: 'token-invalid' }, { main: 'Token', sub: 'invalid', tone: 'grey', dimmed: false, offlineIcon: false }],
  ['api-error 7', { kind: 'api-error', lastCount: 7 }, { main: '7', sub: 'reviews', tone: 'blue', dimmed: true, offlineIcon: false }],
  ['api-error 0', { kind: 'api-error', lastCount: 0 }, { main: '0', sub: 'reviews', tone: 'grey', dimmed: true, offlineIcon: false }],
  ['api-error null', { kind: 'api-error', lastCount: null }, { main: '…', sub: 'reviews', tone: 'blue', dimmed: true, offlineIcon: false }],
];

test.each(cases)('%s', (_name, state, expected) => {
  expect(tileView(state, true)).toEqual({ ...expected, unlocked: false });
});

test('unlocked mirrors !locked', () => {
  expect(tileView({ kind: 'done' }, false).unlocked).toBe(true);
});
