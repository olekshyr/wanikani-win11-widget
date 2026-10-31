import { contextBridge, ipcRenderer } from 'electron';
import type { TileView } from '../core/types';

contextBridge.exposeInMainWorld('tile', {
  onView: (cb: (v: TileView) => void) => ipcRenderer.on('tile:view', (_e, v: TileView) => cb(v)),
  click: () => ipcRenderer.send('tile:click'),
  contextMenu: () => ipcRenderer.send('tile:context-menu'),
  moveTo: (p: { x: number; y: number }) => ipcRenderer.send('tile:move-to', p),
  dragEnd: () => ipcRenderer.send('tile:drag-end'),
  networkChange: () => ipcRenderer.send('tile:network-change'),
  ready: () => ipcRenderer.send('tile:ready'),
});
