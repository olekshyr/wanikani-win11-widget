import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export interface Settings {
  position: { x: number; y: number } | null;
  locked: boolean;
  startWithWindows: boolean;
}

export const DEFAULT_SETTINGS: Settings = { position: null, locked: true, startWithWindows: true };

export function loadSettings(file: string): Settings {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(readFileSync(file, 'utf8')) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(file: string, s: Settings): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(s, null, 2));
}
