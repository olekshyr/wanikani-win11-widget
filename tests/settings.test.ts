import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../src/core/settings';

const file = () => join(mkdtempSync(join(tmpdir(), 'wkw-')), 'sub', 'settings.json');

test('missing file → defaults', () => {
  expect(loadSettings(file())).toEqual(DEFAULT_SETTINGS);
  expect(DEFAULT_SETTINGS).toEqual({ position: null, locked: true, startWithWindows: true });
});

test('round trip', () => {
  const f = file();
  const s = { position: { x: 300, y: 40 }, locked: false, startWithWindows: false };
  saveSettings(f, s);
  expect(loadSettings(f)).toEqual(s);
});

test('corrupt JSON → defaults', () => {
  const f = file();
  saveSettings(f, DEFAULT_SETTINGS);
  writeFileSync(f, '{not json');
  expect(loadSettings(f)).toEqual(DEFAULT_SETTINGS);
});

test('partial file merges with defaults', () => {
  const f = file();
  saveSettings(f, DEFAULT_SETTINGS);
  writeFileSync(f, '{"locked":false}');
  expect(loadSettings(f)).toEqual({ ...DEFAULT_SETTINGS, locked: false });
});
