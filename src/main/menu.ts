import { Menu } from 'electron';

export interface TileMenuOptions {
  locked: boolean;
  startWithWindows: boolean;
  onRefresh(): void;
  onToggleLock(): void;
  onResetPosition(): void;
  onChangeToken(): void;
  onToggleStartup(): void;
  onQuit(): void;
}

export function buildTileMenu(o: TileMenuOptions): Menu {
  return Menu.buildFromTemplate([
    { label: 'Refresh now', click: o.onRefresh },
    { label: o.locked ? 'Unlock position' : 'Lock position', click: o.onToggleLock },
    { label: 'Reset position', click: o.onResetPosition },
    { label: 'Change token…', click: o.onChangeToken },
    { label: 'Start with Windows', type: 'checkbox', checked: o.startWithWindows, click: o.onToggleStartup },
    { type: 'separator' },
    { label: 'Quit', click: o.onQuit },
  ]);
}
