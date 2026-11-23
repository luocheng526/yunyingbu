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
}));
window.addEventListener('DOMContentLoaded', () => {
  document.documentElement.classList.add('xm-native', 'xm-glass');
  document.documentElement.dataset.nativeMaterial = environment.material;
});
