import { expect, test } from 'vitest';
import { resolvePosition } from '../src/core/position';

const primary = { x: 0, y: 0, width: 1920, height: 1040 };
const second = { x: 1920, y: 0, width: 1920, height: 1040 };
const size = { width: 130, height: 130 };

test('no saved position → primary top-left plus 16', () => {
  expect(resolvePosition(null, [primary], { ...primary, x: 0, y: 48 }, size)).toEqual({ x: 16, y: 64 });
});

test('saved position on a second display is kept', () => {
  expect(resolvePosition({ x: 2000, y: 100 }, [primary, second], primary, size)).toEqual({ x: 2000, y: 100 });
});

test('saved position off every display → default', () => {
  expect(resolvePosition({ x: 2000, y: 100 }, [primary], primary, size)).toEqual({ x: 16, y: 16 });
});
