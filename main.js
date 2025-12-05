const { app, BrowserWindow, BrowserView, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');

const DATA_FILE_NAME = 'webglass.json';

let mainWindow = null;
let views = {}; // map tabId -> BrowserView
let tabs = []; // array of tab objects {id, title, url, renderMode}
let activeTabId = null;

let state = {
  history: [],
  lastURL: 'https://www.google.com/',
  tabs: []
};

const BOOKMARKS_FILE_NAME = 'bookmarks.json';

function getBookmarksPath() {
  return path.join(app.getPath('userData'), BOOKMARKS_FILE_NAME);
}

function loadBookmarks() {
  try {
    const p = getBookmarksPath();
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) { console.error('loadBookmarks', e); }
  return [];
}

function saveBookmarks(bm){
  try { fs.writeFileSync(getBookmarksPath(), JSON.stringify(bm, null, 2), 'utf8'); } catch(e){ console.error(e); }
}

function getDataFilePath() {
  return path.join(app.getPath('userData'), DATA_FILE_NAME);
}

function loadState() {
  try {
    const p = getDataFilePath();
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf8');
      state = JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to load state', e);
  }
}

function saveState() {
  try {
    const p = getDataFilePath();
    fs.writeFileSync(p, JSON.stringify(state, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save state', e);
  }
}

function createWindow() {
  loadState();

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.on('resize', resizeView);

  // restore tabs or open default
  if (state.tabs && state.tabs.length) {
    for (const t of state.tabs) {
      openTab(t.url, { restore: true, title: t.title, id: t.id, renderMode: t.renderMode });
    }
  } else {
    const t = openTab(state.lastURL || 'https://www.google.com/');
    setActiveTab(t.id);
  }
}

function createViewForTab(tabId) {
  const bview = new BrowserView({ webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: false } });
  views[tabId] = bview;
  bview.webContents.on('did-navigate', (e, url) => {
    state.lastURL = url;
    state.history = state.history || [];
    state.history.push({ url, ts: Date.now() });
    saveState();
    mainWindow.webContents.send('navigated', { tabId, url });
  });
  bview.webContents.on('page-title-updated', (e, title) => {
    mainWindow.webContents.send('title-updated', { tabId, title });
  });
  bview.webContents.on('console-message', (e, level, msg, line, sourceId) => {
    mainWindow.webContents.send('console-message', { tabId, level, msg, line, sourceId });
  });
  return bview;
}

function openTab(url, opts = {}) {
  const id = opts.id || `tab-${Date.now()}-${Math.floor(Math.random()*1000)}`;
  const title = opts.title || url;
  const renderMode = opts.renderMode || 'native'; // 'native' or 'playwright'/'puppeteer'
  const tab = { id, title, url, renderMode };
  tabs.push(tab);
  state.tabs = tabs.map(t => ({ id: t.id, title: t.title, url: t.url, renderMode: t.renderMode }));
  saveState();

  const bview = createViewForTab(id);
  mainWindow.setBrowserView(bview);
  resizeView();
  if (opts.restore) bview.webContents.loadURL(url).catch(()=>{});
  else bview.webContents.loadURL(url).catch(()=>{});
  return tab;
}

function closeTab(id) {
  const idx = tabs.findIndex(t => t.id === id);
  if (idx === -1) return;
  const t = tabs[idx];
  const bview = views[id];
  if (bview) {
    try { bview.webContents.destroy(); } catch(_){}
    delete views[id];
  }
  tabs.splice(idx,1);
  if (activeTabId === id && tabs.length) setActiveTab(tabs[0].id);
  state.tabs = tabs.map(t => ({ id: t.id, title: t.title, url: t.url, renderMode: t.renderMode }));
  saveState();
}

function setActiveTab(id) {
  const tab = tabs.find(t => t.id === id);
  if (!tab) return;
  activeTabId = id;
  const bview = views[id];
  if (bview) mainWindow.setBrowserView(bview);
  resizeView();
  mainWindow.webContents.send('tab-activated', { id, url: tab.url, title: tab.title });
}

function resizeView() {
  if (!mainWindow || !view) return;
  const b = mainWindow.getContentBounds();
  // leave space on top for the UI (80px)
  view.setBounds({ x: 0, y: 80, width: b.width, height: Math.max(200, b.height - 80) });
  view.setAutoResize({ width: true, height: true });
}

ipcMain.handle('navigate', async (ev, rawInput) => {
  // Simple heuristic: if contains spaces, treat as search. If no scheme but contains dot, assume http.
  let input = (rawInput || '').trim();
  if (!input) return { url: state.lastURL };

  let url = input;
  const looksLikeUrl = /^(https?:)?\/\//i.test(url) || /\./.test(url);
  if (!looksLikeUrl || input.includes(' ')) {
    url = `https://www.google.com/search?q=${encodeURIComponent(input)}`;
  } else if (!/^https?:\/\//i.test(url)) {
    url = 'http://' + url;
  }

  try {
    const tabId = ev.senderTabId || (ev.sender && ev.sender.tabId) || activeTabId;
    const bview = views[tabId];
    if (bview) await bview.webContents.loadURL(url);
    const tab = tabs.find(t=>t.id===tabId);
    if (tab) { tab.url = url; state.tabs = tabs.map(t=>({id:t.id,title:t.title,url:t.url,renderMode:t.renderMode})); saveState(); }
  } catch (e) { console.error('navigate error', e); }
  return { url };
});

ipcMain.handle('reload', (ev, tabId) => { const b = views[tabId||activeTabId]; return b && b.webContents.reload(); });
ipcMain.handle('go-back', (ev, tabId) => { const b = views[tabId||activeTabId]; return b && b.webContents.canGoBack() && b.webContents.goBack(); });
ipcMain.handle('go-forward', (ev, tabId) => { const b = views[tabId||activeTabId]; return b && b.webContents.canGoForward() && b.webContents.goForward(); });
ipcMain.handle('open-devtools', (ev, tabId) => { const b = views[tabId||activeTabId]; return b && b.webContents.openDevTools(); });
ipcMain.handle('close-devtools', (ev, tabId) => { const b = views[tabId||activeTabId]; return b && b.webContents.closeDevTools(); });
ipcMain.handle('view-source', async (ev, tabId) => {
  try {
    const b = views[tabId||activeTabId];
    const html = await b.webContents.executeJavaScript('document.documentElement.outerHTML');
    return html;
  } catch (e) { return '<error>'; }
});

ipcMain.handle('get-state', () => ({ state, bookmarks: loadBookmarks(), tabs }));

ipcMain.handle('toggle-bookmark', (ev, url, title) => {
  const bm = loadBookmarks();
  const idx = bm.findIndex(b => b.url === url);
  if (idx >= 0) bm.splice(idx,1);
  else bm.push({ url, title: title||url, ts: Date.now() });
  saveBookmarks(bm);
  return bm;
});

ipcMain.handle('new-tab', (ev, url) => {
  const t = openTab(url||'https://www.google.com/');
  setActiveTab(t.id);
  return t;
});

ipcMain.handle('close-tab', (ev, id) => { closeTab(id); return { tabs: tabs }; });

ipcMain.handle('switch-tab', (ev, id) => { setActiveTab(id); return { active: id }; });

// Render using helpers (playwright/puppeteer)
const { screenshotWithPuppeteer, screenshotWithPlaywright } = require(path.join(__dirname,'tools','puppeteer_playwright_helper'));
ipcMain.handle('render-screenshot', async (ev, { url, engine }) => {
  try {
    const tmp = path.join(app.getPath('temp'), `webglass-${Date.now()}.png`);
    if (engine === 'puppeteer') await screenshotWithPuppeteer(url, tmp);
    else await screenshotWithPlaywright(url, tmp);
    return { path: tmp };
  } catch (e) { console.error(e); return { error: e.message }; }
});

ipcMain.handle('get-html-playwright', async (ev, url) => {
  try {
    const { getHtmlWithPlaywright } = require(path.join(__dirname,'tools','puppeteer_playwright_helper'));
    const html = await getHtmlWithPlaywright(url);
    return { html };
  } catch (e) { return { error: e.message } }
});

app.whenReady().then(() => {
  createWindow();

  globalShortcut.register('CommandOrControl+L', () => {
    if (mainWindow) mainWindow.webContents.send('focus-address');
  });
  globalShortcut.register('CommandOrControl+U', () => {
    if (mainWindow) mainWindow.webContents.send('shortcut-view-source');
  });
  globalShortcut.register('CommandOrControl+Shift+I', () => {
    if (view) view.webContents.toggleDevTools();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  saveState();
  if (process.platform !== 'darwin') app.quit();
});
