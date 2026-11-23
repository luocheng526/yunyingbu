const { app, BrowserWindow, ipcMain, Menu, screen, shell, nativeTheme, dialog, net } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { centeredBounds, allowedUrl, desktopOrigin, backgroundFor } = require('./window-policy.cjs');
const { UpdateService } = require('./update-service.cjs');
const { startReplacement } = require('./portable-update.cjs');
const { createUpdateFetch } = require('./update-network.cjs');

const origin = desktopOrigin(app.isPackaged, process.env.XM_DESKTOP_PREVIEW);
const material = backgroundFor(process.platform, os.release());
let mainWindow, updater, updateTimer, updateStartTimer, replacementJob, confirmingUpdate = false;
const cssFiles = ['desktop.css', 'modules.css', 'layout.css', 'updates.css'];
const logo = 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, 'assets', 'logo-transparent.png')).toString('base64');
function rendererSource() {
  return fs.readFileSync(path.join(__dirname, 'renderer', 'shortcut-model.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(__dirname, 'renderer', 'desktop.js'), 'utf8').replace('__XM_APP_ICON__', JSON.stringify(logo)) + '\n' +
    fs.readFileSync(path.join(__dirname, 'renderer', 'layout.js'), 'utf8') + '\n' +
    fs.readFileSync(path.join(__dirname, 'renderer', 'updates.js'), 'utf8');
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
  app.whenReady().then(() => { setupUpdates(); createWindow(); });
}

function setupUpdates() {
  const cacheDir = path.join(app.getPath('userData'),'app-updates');
  updater = new UpdateService({currentVersion:app.getVersion(),
    supported:app.isPackaged && process.platform === 'win32' && process.arch === 'x64' && !!process.env.PORTABLE_EXECUTABLE_FILE,
    cacheDir, fetch:createUpdateFetch(net),
    onState:state=>{
      const contents=mainWindow?.webContents;
      if(contents && !contents.isDestroyed() && allowedUrl(contents.getURL(),origin)) contents.send('xm:update-state',state);
    }});
  try {
    const result=JSON.parse(fs.readFileSync(path.join(cacheDir,'last-result.json'),'utf8'));
    if(result.status==='error') updater.emit({status:'error',phase:'install',message:result.message});
  } catch {}
  updateStartTimer=setTimeout(()=>updater.check(),10000+Math.random()*10000); updateStartTimer.unref();
  updateTimer=setInterval(()=>updater.check(),6*60*60*1000); updateTimer.unref();
}

function trustedSender(event) {
  return mainWindow && event.sender === mainWindow.webContents && event.senderFrame === mainWindow.webContents.mainFrame && allowedUrl(event.senderFrame.url,origin);
}
ipcMain.handle('xm:update',async(event,action)=>{
  if(!trustedSender(event) || !updater) throw new Error('Update request denied');
  if(action==='state') return updater.snapshot();
  if(action==='check') return updater.check();
  if(action==='download') return updater.download();
  if(action==='cancel') return updater.cancel();
  if(action!=='install' || confirmingUpdate || updater.state.status!=='ready') return updater.snapshot();
  confirmingUpdate=true;
  try {
    const {response}=await dialog.showMessageBox(mainWindow,{type:'question',title:'重启并更新 App',
      message:'现在重启并更新到 '+updater.state.update.version+'？',
      detail:'请先保存正在编辑的内容。更新将关闭并重新打开 App，账号和快捷菜单设置会保留。',
      buttons:['稍后更新','重启并更新'],defaultId:0,cancelId:0,noLink:true});
    if(response!==1) return updater.snapshot();
    const {file,update}=await updater.verifiedPackage();
    updater.emit({status:'installing',message:''});
    replacementJob=await startReplacement({target:process.env.PORTABLE_EXECUTABLE_FILE,staged:file,update,cacheDir:updater.cacheDir});
    app.quit();
    return updater.snapshot();
  } catch(error) {
    // The original executable stays in place if preparation or verification fails.
    return updater.emit({status:'error',phase:'download',message:error.message || '更新未完成，请重试'});
  } finally { confirmingUpdate=false; }
});

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
  contents.on('will-prevent-unload',()=>{
    if(replacementJob && updater.state.status==='installing') {
      replacementJob.cancel(); replacementJob=null;
      updater.emit({status:'ready',message:'页面阻止了关闭，请保存工作后再重启更新'});
    }
  });
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
app.on('before-quit',()=>updater?.cancel());
app.on('will-quit',()=>{clearTimeout(updateStartTimer);clearInterval(updateTimer);});
