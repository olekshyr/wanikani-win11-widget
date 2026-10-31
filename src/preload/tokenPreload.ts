import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('tokenApi', {
  save: (raw: string) => ipcRenderer.invoke('token:save', raw),
  openLink: () => ipcRenderer.send('token:open-link'),
});
