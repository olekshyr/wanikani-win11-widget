import { BrowserWindow } from 'electron';
import { join } from 'node:path';
import { attachToDesktop } from './desktopLayer';

/** The 110 px tile plus a 10 px margin on every side for its shadow. */
export const TILE_WINDOW_SIZE = { width: 130, height: 130 };

export function createTileWindow(pos: { x: number; y: number }): BrowserWindow {
  const win = new BrowserWindow({
    ...pos,
    ...TILE_WINDOW_SIZE,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, '..', 'preload', 'tilePreload.js'),
      contextIsolation: true,
      sandbox: true,
    },
  });
  win.loadFile(join(__dirname, '..', 'renderer', 'tile.html'));
  win.once('ready-to-show', () => {
    attachToDesktop(win);
    win.showInactive();
  });
  return win;
}
