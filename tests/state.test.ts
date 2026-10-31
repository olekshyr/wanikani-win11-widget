import { describe, expect, test } from 'vitest';
import { clickAction, nextTileState } from '../src/core/state';
import type { TileState } from '../src/core/types';

describe('nextTileState', () => {
  const any: TileState = { kind: 'loading' };
  test('ok with count 5 → reviews', () => {
    expect(nextTileState(any, { kind: 'ok', count: 5 })).toEqual({ kind: 'reviews', count: 5 });
  });
  test('ok with count 0 → done', () => {
    expect(nextTileState(any, { kind: 'ok', count: 0 })).toEqual({ kind: 'done' });
  });
  test('unauthorized → token-invalid', () => {
    expect(nextTileState(any, { kind: 'unauthorized' })).toEqual({ kind: 'token-invalid' });
  });
  test('offline → offline', () => {
    expect(nextTileState({ kind: 'reviews', count: 9 }, { kind: 'offline' })).toEqual({ kind: 'offline' });
  });
  test('api-error keeps last count from reviews', () => {
    expect(nextTileState({ kind: 'reviews', count: 5 }, { kind: 'api-error' })).toEqual({ kind: 'api-error', lastCount: 5 });
  });
  test('api-error after done keeps 0', () => {
    expect(nextTileState({ kind: 'done' }, { kind: 'api-error' })).toEqual({ kind: 'api-error', lastCount: 0 });
  });
  test('api-error after api-error keeps its lastCount', () => {
    expect(nextTileState({ kind: 'api-error', lastCount: 3 }, { kind: 'api-error' })).toEqual({ kind: 'api-error', lastCount: 3 });
  });
  test('api-error after loading or offline has no count', () => {
    expect(nextTileState({ kind: 'loading' }, { kind: 'api-error' })).toEqual({ kind: 'api-error', lastCount: null });
    expect(nextTileState({ kind: 'offline' }, { kind: 'api-error' })).toEqual({ kind: 'api-error', lastCount: null });
  });
});

describe('clickAction', () => {
  const all: TileState[] = [
    { kind: 'setup' }, { kind: 'loading' }, { kind: 'reviews', count: 2 }, { kind: 'done' },
    { kind: 'offline' }, { kind: 'token-invalid' }, { kind: 'api-error', lastCount: 1 },
  ];
  test('unlocked → none for every state', () => {
    for (const s of all) expect(clickAction(s, false)).toBe('none');
  });
  test('locked dashboard states open the dashboard', () => {
    for (const s of [all[2], all[3], all[4], all[6]]) expect(clickAction(s, true)).toBe('open-dashboard');
  });
  test('locked setup and token-invalid open the token window', () => {
    expect(clickAction({ kind: 'setup' }, true)).toBe('open-token-window');
    expect(clickAction({ kind: 'token-invalid' }, true)).toBe('open-token-window');
  });
  test('locked loading does nothing', () => {
    expect(clickAction({ kind: 'loading' }, true)).toBe('none');
  });
});
