const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  navigate: (input) => ipcRenderer.invoke('navigate', input),
  newTab: (url) => ipcRenderer.invoke('new-tab', url),
  closeTab: (id) => ipcRenderer.invoke('close-tab', id),
  switchTab: (id) => ipcRenderer.invoke('switch-tab', id),
  reload: () => ipcRenderer.invoke('reload'),
  goBack: () => ipcRenderer.invoke('go-back'),
  goForward: () => ipcRenderer.invoke('go-forward'),
  openDevtools: () => ipcRenderer.invoke('open-devtools'),
  closeDevtools: () => ipcRenderer.invoke('close-devtools'),
  viewSource: () => ipcRenderer.invoke('view-source'),
  getState: () => ipcRenderer.invoke('get-state'),
  toggleBookmark: (url, title) => ipcRenderer.invoke('toggle-bookmark', url, title),
  renderScreenshot: (opts) => ipcRenderer.invoke('render-screenshot', opts),
  getHtmlPlaywright: (url) => ipcRenderer.invoke('get-html-playwright', url),
  on: (channel, cb) => ipcRenderer.on(channel, (e, data) => cb(data))
});
