const { contextBridge, ipcRenderer } = require('electron');
const arg = process.argv.find(value => value.startsWith('--xm-window='));
const environment = arg ? JSON.parse(decodeURIComponent(arg.slice('--xm-window='.length))) : {};
contextBridge.exposeInMainWorld('XmDesktop', Object.freeze({
  platform: environment.platform,
  material: environment.material,
  version: environment.version,
  minimize: () => ipcRenderer.send('xm:window', 'minimize'),
  maximize: () => ipcRenderer.send('xm:window', 'maximize'),
  close: () => ipcRenderer.send('xm:window', 'close'),
  center: () => ipcRenderer.send('xm:window', 'center'),
  updates: Object.freeze({
    state: () => ipcRenderer.invoke('xm:update','state'),
    check: () => ipcRenderer.invoke('xm:update','check'),
    download: () => ipcRenderer.invoke('xm:update','download'),
    cancel: () => ipcRenderer.invoke('xm:update','cancel'),
    install: () => ipcRenderer.invoke('xm:update','install'),
    onState: callback => {
      if (typeof callback !== 'function') return () => {};
      const listener = (_event,state) => callback(state);
      ipcRenderer.on('xm:update-state',listener);
      return () => ipcRenderer.removeListener('xm:update-state',listener);
    },
  }),
}));
window.addEventListener('DOMContentLoaded', () => {
  document.documentElement.classList.add('xm-native', 'xm-glass');
  document.documentElement.dataset.nativeMaterial = environment.material;
});
