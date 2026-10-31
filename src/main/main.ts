import { app, BrowserWindow, ipcMain, net, powerMonitor, safeStorage, screen, shell } from 'electron';
import { join } from 'node:path';
import { resolvePosition } from '../core/position';
import { RefreshScheduler, singleFlight } from '../core/scheduler';
import { loadSettings, saveSettings, type Settings } from '../core/settings';
import { clickAction, nextTileState } from '../core/state';
import { createTokenStore } from '../core/tokenStore';
import type { TileState } from '../core/types';
import { tileView } from '../core/view';
import { DASHBOARD_URL, fetchReviewCount } from '../core/wanikani';
import { desktopReady, sendToBottom } from './desktopLayer';
import { buildTileMenu } from './menu';
import { createTileWindow, TILE_WINDOW_SIZE } from './tileWindow';
import { openTokenWindow } from './tokenWindow';

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.whenReady().then(init);
}

function init(): void {
  const settingsFile = join(app.getPath('userData'), 'settings.json');
  const settings: Settings = loadSettings(settingsFile);
  const tokenStore = createTokenStore(join(app.getPath('userData'), 'token.bin'), {
    encryptString: (s) => safeStorage.encryptString(s),
    decryptString: (b) => safeStorage.decryptString(b),
  });

  let token = tokenStore.load();
  let state: TileState = token ? { kind: 'loading' } : { kind: 'setup' };

  let quitting = false;
  app.on('before-quit', () => { quitting = true; });

  const createTile = (): BrowserWindow => {
    const workAreas = screen.getAllDisplays().map((d) => d.workArea);
    const pos = resolvePosition(settings.position, workAreas, screen.getPrimaryDisplay().workArea, TILE_WINDOW_SIZE);
    const w = createTileWindow(pos);
    // The tile is owned by the desktop, so Windows destroys it when Explorer restarts: bring it back.
    w.on('closed', () => { if (!quitting) recreateWhenDesktopReady(); });
    return w;
  };
  const recreateWhenDesktopReady = () => {
    const attempt = () => {
      if (quitting || !win.isDestroyed()) return;
      if (desktopReady()) win = createTile();
      else setTimeout(attempt, 2000);
    };
    setTimeout(attempt, 2000);
  };
  let win = createTile();
  app.on('second-instance', () => { if (win.isDestroyed()) win = createTile(); });

  const save = () => saveSettings(settingsFile, settings);
  const render = () => {
    if (!win.isDestroyed()) win.webContents.send('tile:view', tileView(state, settings.locked));
  };
  const applyLoginItem = () => {
    if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: settings.startWithWindows });
  };

  const refresh = singleFlight(async () => {
    if (!token) return;
    state = nextTileState(state, await fetchReviewCount(token));
    scheduler.setOffline(state.kind === 'offline');
    render();
  });
  const scheduler = new RefreshScheduler(() => void refresh(), () => net.isOnline());
  let schedulerStarted = false;
  const startScheduler = () => {
    if (schedulerStarted) return void refresh();
    schedulerStarted = true;
    scheduler.start();
  };

  const onTokenSaved = (t: string) => {
    tokenStore.save(t);
    token = t;
    state = { kind: 'loading' };
    render();
    startScheduler();
  };

  ipcMain.on('tile:ready', render);

  ipcMain.on('tile:click', () => {
    switch (clickAction(state, settings.locked)) {
      case 'open-dashboard':
        void shell.openExternal(DASHBOARD_URL);
        scheduler.onDashboardOpened();
        break;
      case 'open-token-window':
        openTokenWindow(onTokenSaved);
        break;
    }
    sendToBottom(win);
  });

  ipcMain.on('tile:context-menu', () => {
    buildTileMenu({
      locked: settings.locked,
      startWithWindows: settings.startWithWindows,
      onRefresh: () => void refresh(),
      onToggleLock: () => {
        settings.locked = !settings.locked;
        save();
        render();
      },
      onResetPosition: () => {
        settings.position = null;
        save();
        const { x, y } = resolvePosition(null, [], screen.getPrimaryDisplay().workArea, TILE_WINDOW_SIZE);
        win.setPosition(x, y);
        sendToBottom(win);
      },
      onChangeToken: () => openTokenWindow(onTokenSaved),
      onToggleStartup: () => {
        settings.startWithWindows = !settings.startWithWindows;
        save();
        applyLoginItem();
      },
      onQuit: () => app.quit(),
    }).popup({ window: win, callback: () => sendToBottom(win) });
  });

  ipcMain.on('tile:move-to', (_e, p: { x: number; y: number }) => {
    if (!settings.locked) win.setPosition(Math.round(p.x), Math.round(p.y));
  });

  ipcMain.on('tile:drag-end', () => {
    const [x, y] = win.getPosition();
    settings.position = { x, y };
    save();
    sendToBottom(win);
  });

  ipcMain.on('tile:network-change', () => scheduler.onNetworkChange());
  powerMonitor.on('resume', () => scheduler.onResume());

  applyLoginItem();
  if (token) startScheduler();
}

app.on('window-all-closed', () => {
  // The tile is the app; closing a token window must not quit it.
});
