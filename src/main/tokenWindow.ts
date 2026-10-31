import { BrowserWindow, ipcMain, shell } from 'electron';
import { join } from 'node:path';
import { fetchReviewCount, normalizeToken, TOKEN_SETTINGS_URL } from '../core/wanikani';

export type SaveTokenResult = { ok: true } | { ok: false; error: 'invalid' | 'unreachable' };

let current: BrowserWindow | null = null;
let onSavedCurrent: (token: string) => void = () => {};

ipcMain.handle('token:save', async (_e, raw: string): Promise<SaveTokenResult> => {
  const token = normalizeToken(raw);
  const result = await fetchReviewCount(token);
  if (result.kind === 'unauthorized') return { ok: false, error: 'invalid' };
  if (result.kind !== 'ok') return { ok: false, error: 'unreachable' };
  onSavedCurrent(token);
  current?.close();
  return { ok: true };
});

ipcMain.on('token:open-link', () => void shell.openExternal(TOKEN_SETTINGS_URL));

export function openTokenWindow(onSaved: (token: string) => void): void {
  onSavedCurrent = onSaved;
  if (current && !current.isDestroyed()) {
    current.focus();
    return;
  }
  current = new BrowserWindow({
    width: 420,
    height: 260,
    resizable: false,
    maximizable: false,
    minimizable: false,
    autoHideMenuBar: true,
    title: 'WaniKani Widget — API token',
    webPreferences: {
      preload: join(__dirname, '..', 'preload', 'tokenPreload.js'),
      contextIsolation: true,
      sandbox: true,
    },
  });
  current.setMenu(null);
  current.loadFile(join(__dirname, '..', 'renderer', 'token.html'));
  current.on('closed', () => { current = null; });
}
