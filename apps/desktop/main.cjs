const { app, BrowserWindow, ipcMain, Menu, screen, shell, nativeTheme, dialog } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { centeredBounds, allowedUrl, desktopOrigin, backgroundFor } = require('./window-policy.cjs');

const origin = desktopOrigin(app.isPackaged, process.env.XM_DESKTOP_PREVIEW);
const material = backgroundFor(process.platform, os.release());
let mainWindow;
const cssFiles = ['desktop.css', 'modules.css', 'layout.css'];
const logo = 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, 'assets', 'logo-transparent.png')).toString('base64');
function rendererSource() {
  return fs.readFileSync(path.join(__dirname, 'renderer', 'shortcut-model.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(__dirname, 'renderer', 'desktop.js'), 'utf8').replace('__XM_APP_ICON__', JSON.stringify(logo)) + '\n' +
    fs.readFileSync(path.join(__dirname, 'renderer', 'layout.js'), 'utf8');
}

app.setName('甄选未来');
app.setAppUserModelId('cn.xingmai.zhenxuan.desktop');
// Keep a read-only development preview separate from employees' running App.
if (!app.isPackaged && process.env.XM_DESKTOP_PREVIEW) {
  app.setPath('userData', path.join(app.getPath('userData'), 'preview'));
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); } });
  app.whenReady().then(createWindow);
}

function createWindow() {
  Menu.setApplicationMenu(null);
  nativeTheme.themeSource = 'light';
  const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  const bounds = centeredBounds(area);
  mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: Math.min(820, bounds.width), minHeight: Math.min(580, bounds.height),
    title: '甄选未来', show: false, frame: false, icon: path.join(__dirname, 'assets', 'icon.ico'),
    backgroundColor: material === 'solid' ? '#e5e2dc' : '#00000000',
    ...(material === 'acrylic' ? { backgroundMaterial: 'acrylic' } : {}),
    ...(material === 'vibrancy' ? { transparent: true, vibrancy: 'under-window', visualEffectState: 'active' } : {}),
    roundedCorners: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true,
      partition: 'persist:zhenxuan-native',
      additionalArguments: ['--xm-window=' + encodeURIComponent(JSON.stringify({ platform: process.platform, material, version: app.getVersion() }))],
    },
  });
  const contents = mainWindow.webContents;
  contents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  contents.session.setPermissionCheckHandler(() => false);
  contents.setWindowOpenHandler(({ url }) => {
    if (allowedUrl(url, origin)) contents.loadURL(url);
    else if (/^https:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  contents.on('will-navigate', (event, url) => {
    if (!allowedUrl(url, origin)) { event.preventDefault(); if (/^https:\/\//i.test(url)) shell.openExternal(url); }
  });
  contents.on('will-redirect', (event, url) => { if (!allowedUrl(url, origin)) event.preventDefault(); });
  contents.on('will-attach-webview', event => event.preventDefault());
  contents.on('dom-ready', async () => {
    if (!allowedUrl(contents.getURL(), origin)) return;
    await contents.insertCSS(cssFiles.map(file => fs.readFileSync(path.join(__dirname, 'renderer', file), 'utf8')).join('\n'));
    await contents.executeJavaScript(rendererSource());
  });
  let loadErrorOpen = false;
  contents.on('did-fail-load', async (_event, code, _description, _url, isMainFrame) => {
    if (!isMainFrame || code === -3 || !mainWindow || mainWindow.isDestroyed()) return;
    if (loadErrorOpen) return;
    loadErrorOpen = true;
    mainWindow.show();
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'warning', title: '暂时无法连接',
      message: '暂时无法连接公司网站', detail: '请检查网络连接后重试。',
      buttons: ['重试', '关闭 App'], defaultId: 0, cancelId: 1,
    });
    loadErrorOpen = false;
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (response === 0) mainWindow.loadURL(target.href).catch(() => {});
    else mainWindow.close();
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
  const target = new URL('/home?app=glass', origin);
  if (!app.isPackaged && process.env.XM_DESKTOP_LOGIN_PREVIEW === '1') target.pathname = '/login';
  mainWindow.loadURL(target.href).catch(() => {});
}

ipcMain.on('xm:window', (event, action) => {
  if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== mainWindow.webContents.mainFrame || !allowedUrl(event.senderFrame.url, origin)) return;
  if (action === 'minimize') mainWindow.minimize();
  if (action === 'maximize') mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
  if (action === 'close') mainWindow.close();
  if (action === 'center') {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    mainWindow.setBounds(centeredBounds(screen.getDisplayMatching(mainWindow.getBounds()).workArea));
  }
});
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
